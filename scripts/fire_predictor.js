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

        const cacheKey = `la=${latitude},lo=${longitude}`;
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


async function runModelPredictionDistrict(districtID, dateNumber) {
    try {
        const model = await tf.loadLayersModel('../Model/Forest_Fire_Predictor_3/model.json');

        const cacheKey = `districtID=${districtID}`;
        const cachedParameters = JSON.parse(sessionStorage.getItem(cacheKey));

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
            sessionStorage.setItem(cacheKey, JSON.stringify(groupedData));
        }

        const inputTensor = tf.tensor([groupedData[dateNumber]]);
        const prediction = model.predict(inputTensor);
        const predictionArray = await prediction.array();

        inputTensor.dispose();
        prediction.dispose();

        return predictionArray[0];

    } catch (error) {
        console.error('Error during prediction:', error);
        throw error;
    }
}