var cloudURL = "https://pyropredictor.netlify.app/.netlify/functions/api";

class L2 {

    static className = 'L2';

    constructor(config) {
       return tf.regularizers.l1l2(config)
    }
}
tf.serialization.registerClass(L2);

var model_original;
var model_modify;

function getDateRange(i) {
    let now = new Date();
    now.setDate(now.getDate() + i);

    let options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }; 
    let formatter = new Intl.DateTimeFormat('en-GB', options); 

    let parts = formatter.formatToParts(now); 
    let day = parts.find(part => part.type === 'day').value; 
    let month = parts.find(part => part.type === 'month').value; 
    let year = parts.find(part => part.type === 'year').value; 

    return `${day}-${month}-${year}`; 
}

var dateOfDistrictModify = localStorage.getItem("Date");

console.log(dateOfDistrictModify, getDateRange(0));
if (dateOfDistrictModify == null || getDateRange(0) != dateOfDistrictModify) {
    console.log("Clearing localStorage...");
    localStorage.clear();
    localStorage.setItem("Date", getDateRange(0));
} else {
    console.log("Condition not met.");
}

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

loadModels();

async function runModelPrediction(latitude, longitude) {
    try {
        if (!model_original || !model_modify) {
            console.log("Models are not loaded yet, waiting...");
            await loadModels();
        }

        const cacheKey = `la=${latitude.toFixed(3)},lo=${longitude.toFixed(3)}`;
        const cachedParameters = JSON.parse(sessionStorage.getItem(cacheKey));

        let groupedData;

        if (cachedParameters !== null) {
            console.log('Using cached parameters');
            groupedData = cachedParameters;
        } else {
            const response = await fetch(cloudURL + `/getLocationData?locationLatitude=${latitude}&locationLongitude=${longitude}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            groupedData = await response.json();
            sessionStorage.setItem(cacheKey, JSON.stringify(groupedData));
        }

        const results = [];
        for (let i = 0; i < 7; i++) {
            const inputTensor = tf.tensor([groupedData[i]]);
            const prediction = model_modify.predict(inputTensor);
            const predictionArray = await prediction.array();

            if(parseFloat(predictionArray[0]) < 0){
                results.push(0);
            } else {
                results.push(predictionArray[0] * 10);
            }

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
        const cachedParameters = JSON.parse(localStorage.getItem(cacheKey));

        let groupedData;

        if (cachedParameters !== null) {
            console.log('Using cached parameters');
            groupedData = cachedParameters;
        } else {
            const response = await fetch(`${cloudURL}/getDistrictData?districtID=${districtID}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            groupedData = await response.json();
            localStorage.setItem(cacheKey, JSON.stringify(groupedData));
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

        const zeroBiases = tf.zerosLike(biases);

        const weightsArray = weights.arraySync();

        for (let i = 0; i < weightArray.length; i++) {
            for (let j = 0; j < weightsArray[i].length; j++) {
                weightsArray[i][j] *= weightArray[i];
            }
        }

        const modifiedWeights = tf.tensor(weightsArray);
        
        firstLayerModify.setWeights([modifiedWeights, zeroBiases]);
    } catch (error) {
        console.error('Error during prediction:', error);
        throw error;
    }
}

async function changeWeights() {
    document.getElementById('weightModalClose').click();
    var weightArray = [];
    for(var i= 0; i < 20; i++){
        weightArray.push(document.getElementById('weightSlider' + i).value);
    }

    await modifyModelWeights(weightArray);
    await loadDistrictLayers(0);
}
