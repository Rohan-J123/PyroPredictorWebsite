var cloudURL = "https://pyropredictor.netlify.app/.netlify/functions/api";

class L2 {

    static className = 'L2';

    constructor(config) {
       return tf.regularizers.l1l2(config)
    }
}
tf.serialization.registerClass(L2);

async function runModelPrediction(latitude, longitude) {
    try {
        const model = await tf.loadLayersModel('../Model/Forest_Fire_Predictor_3/model.json');

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
            const prediction = model.predict(inputTensor);
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

var weightArray = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

async function runModelPredictionDistrict(districtID, dateNumber) {
    try {
        const model_original = await tf.loadLayersModel('../Model/Forest_Fire_Predictor_3_Original/model.json');
        const model_modify = await tf.loadLayersModel('../Model/Forest_Fire_Predictor_3_Modify/model.json');

        const cacheKey = `districtID=${districtID}`;
        const cachedParameters = JSON.parse(localStorage.getItem(cacheKey));

        let groupedData;

        if (cachedParameters !== null && localStorage.getItem("Date") !== null && getDateRange(0) == localStorage.getItem("Date")) {
            console.log('Using cached parameters');
            groupedData = cachedParameters;
        } else {
            const response = await fetch(`${cloudURL}/getDistrictData?districtID=${districtID}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            groupedData = await response.json();
            localStorage.setItem(cacheKey, JSON.stringify(groupedData));
            localStorage.setItem("Date", getDateRange(0));
        }

        const firstLayerOriginal = model_original.layers[0];
        const firstLayerModify = model_modify.layers[0];

        const [weights, biases] = firstLayerOriginal.getWeights();
        const weightsArray = await weights.array();
        for (let i = 0; i < weightArray.length; i++) {
            for (let j = 0; j < weightsArray[i].length; j++) {
                weightsArray[i][j] *= weightArray[i];
            }
        }

        const modifiedWeights = tf.tensor(weightsArray);
        firstLayerModify.setWeights([modifiedWeights, biases]);

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