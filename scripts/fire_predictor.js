const cloudURL = "https://pyropredictor.netlify.app/.netlify/functions/api";

class L2 {
    static className = 'L2';

    constructor(config) {
        return tf.regularizers.l1l2(config);
    }
}
tf.serialization.registerClass(L2);

let model_original;
let model_modify;

function getDateRange(offset) {
    const now = new Date();
    now.setDate(now.getDate() + offset);

    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-GB', options);

    const parts = formatter.formatToParts(now);
    const day = parts.find(part => part.type === 'day').value;
    const month = parts.find(part => part.type === 'month').value;
    const year = parts.find(part => part.type === 'year').value;

    return `${day}-${month}-${year}`;
}

async function initializeLocalStorage() {
    const dateOfDistrictModify = localStorage.getItem("Date");

    if (!dateOfDistrictModify || getDateRange(0) !== dateOfDistrictModify) {
        console.log("Clearing localStorage...");
        localStorage.clear();
        localStorage.setItem("Date", getDateRange(0));

        try {
            const response = await fetch(`${cloudURL}/getDistrictData`);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }

            const districtData = await response.json();

            districtData.forEach(district => {
                const districtNumber = district["id"];
                const cacheKey = `districtID=${districtNumber}`;
                const groupedData = [];

                for (let j = 0; j < 7; j++) {
                    const dataKey = `data${j}`;
                    if (district.hasOwnProperty(dataKey)) {
                        groupedData.push(district[dataKey]);
                    }
                }

                localStorage.setItem(cacheKey, JSON.stringify(groupedData));
            });
        } catch (error) {
            console.error("Error fetching district data:", error);
        }
    } else {
        console.log("Latest Data Already.");
    }
}

let localStorageInitPromise = initializeLocalStorage();

async function loadModels() {
    try {
        model_original = await tf.loadLayersModel('../Model/Forest_Fire_Predictor_3_Original/model.json');
        model_modify = await tf.loadLayersModel('../Model/Forest_Fire_Predictor_3_Modify/model.json');

        console.log("Models loaded successfully");
        return { model_original, model_modify };
    } catch (error) {
        console.error('Error loading models:', error);
        throw error;
    }
}

async function runModelPrediction(latitude, longitude) {
    try {
        if (!model_original || !model_modify) {
            console.log("Models are not loaded yet, waiting...");
            await loadModels();
        }

        const cacheKey = `la=${latitude.toFixed(3)},lo=${longitude.toFixed(3)}`;
        let groupedData = JSON.parse(sessionStorage.getItem(cacheKey));

        if (!groupedData) {
            const response = await fetch(`${cloudURL}/getLocationData?locationLatitude=${latitude}&locationLongitude=${longitude}`);

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }

            groupedData = await response.json();
            sessionStorage.setItem(cacheKey, JSON.stringify(groupedData));
        } else {
            console.log('Using cached parameters');
        }

        const results = [];

        for (let i = 0; i < 7; i++) {
            const inputTensor = tf.tensor([groupedData[i]]);
            const prediction = model_modify.predict(inputTensor);
            const predictionArray = await prediction.array();

            results.push(Math.max(0, predictionArray[0] * 10));

            inputTensor.dispose();
            prediction.dispose();
        }

        return results;
    } catch (error) {
        console.error('Error during prediction:', error);
        throw error;
    }
}

async function runModelPredictionDistrict(districtID, dateNumber) {
    try {
        if (!model_original || !model_modify) {
            console.log("Models are not loaded yet, waiting...");
            await loadModels();
        }

        const cacheKey = `districtID=${districtID}`;
        var groupedData = JSON.parse(localStorage.getItem(cacheKey));

        if (!groupedData) {
            console.log("District Data not loaded yet...")
            await localStorageInitPromise;
            groupedData = JSON.parse(localStorage.getItem(cacheKey));
        }

        const inputTensor = tf.tensor([groupedData[dateNumber]]);
        const prediction = model_modify.predict(inputTensor);
        const predictionArray = await prediction.array();

        inputTensor.dispose();
        prediction.dispose();

        return predictionArray[0];
    } catch (error) {
        console.error('Error during prediction:', error);
        throw error;
    }
}

async function modifyModelWeights(weightArray) {
    try {
        const firstLayerOriginal = model_original.getLayer('dense');
        const firstLayerModify = model_modify.getLayer('dense');

        const [weights, biases] = firstLayerOriginal.getWeights();
        const weightsArray = weights.arraySync();

        for (let i = 0; i < weightArray.length; i++) {
            for (let j = 0; j < weightsArray[i].length; j++) {
                weightsArray[i][j] *= weightArray[i];
            }
        }

        const modifiedWeights = tf.tensor(weightsArray);
        const zeroBiases = tf.zerosLike(biases);

        firstLayerModify.setWeights([modifiedWeights, zeroBiases]);

        console.log("Model weights modified successfully");
    } catch (error) {
        console.error('Error modifying model weights:', error);
        throw error;
    }
}

async function changeWeights() {
    try {
        document.getElementById('weightModalClose').click();

        const weightArray = Array.from({ length: 20 }, (_, i) => {
            return parseFloat(document.getElementById('weightSlider' + i).value);
        });

        await modifyModelWeights(weightArray);
        await loadDistrictLayers(0);
    } catch (error) {
        console.error('Error changing weights:', error);
    }
}