var map = L.map('map', {attributionControl: false}).setView([23, 80], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.zoomControl && map.removeControl(map.zoomControl);

var geoJSONLayers = [];

if(window.innerHeight < 500){
    document.getElementById('slidersDiv').style.left = "85px";
}

async function determineColour(districtID, dateNumber, signal) {
    try {
        if (signal.aborted) {
            return null;
        }

        var colourResult = await runModelPredictionDistrict(districtID, dateNumber);
        console.log("ColourResult: " + colourResult);

        if (colourResult !== null && colourResult !== undefined) {
            var colourVal;
            if (colourResult < 1) {
                colourVal = 'green';
            } else if (colourResult < 2) {
                colourVal = 'yellow';
            } else if (colourResult < 3) {
                colourVal = 'orange';
            } else {
                colourVal = 'red';
            }
            return [colourVal, colourResult];
        } else {
            console.error("Invalid colourResult:", colourResult);
            return ['black', 0];
        }
    } catch (error) {
        console.error("Error during prediction:", error);
        return ['black', 0];
    }
}



let controllers = [];

function abortAllRequests() {
    controllers.forEach(controller => {
        controller.abort();
        geoJSONLayers.forEach(function(layer) {
            map.removeLayer(layer);
        });
        geoJSONLayers = [];
        console.log("Aborted previous request");
    });
    controllers = [];
}

async function donateAmount() {
    try {
        if (!window.martian) {
            alert("Martian Wallet extension is not available.");
            console.error("Martian Wallet extension is not available.");
            return;
        }

        const response = await window.martian.connect();
        if (!response || !response.address) {
            alert("Failed to connect to Martian Wallet.");
            console.error("Failed to connect to Martian Wallet.");
            return;
        }

        const sender = response.address;

        const recipient = "0x7f0b906f47b02208ab52c1c6ade8460c8d491045c6ea4d2194d61b29bf53ee8d";
        const customAmount = document.getElementById('amountInput').value;

        if (!customAmount || isNaN(customAmount) || customAmount <= 0) {
            alert("Invalid amount entered. Please enter a valid number greater than zero.");
            console.error("Invalid amount entered.");
            return;
        }

        const payload = {
            function: "0x1::coin::transfer",
            type_arguments: ["0x1::aptos_coin::AptosCoin"],
            arguments: [recipient, customAmount.toString()]
        };

        const options = {
            max_gas_amount: "10000"
        };

        const transactionRequest = await window.martian.generateTransaction(sender, payload, options);
        const txnResponse = await window.martian.submitTransaction(transactionRequest);
        console.log("Transaction successful:", txnResponse);

        const closeButton = document.getElementById('donateModalClose');
        if (closeButton) {
            closeButton.click();
        } else {
            console.error("Modal close button not found.");
        }
        
        alert("Amount donated successfully!");
    } catch (error) {
        console.error("Error connecting wallet or generating transaction:", error);
        alert("An error occurred while processing the transaction. Please try again.");
    }
}

async function loadDistrictLayers(dateNumber) {
    abortAllRequests();

    const controller = new AbortController();
    controllers.push(controller);
    const signal = controller.signal;

    document.getElementById('spinnerCircle').style.display = "block";
    document.getElementById('background').style.display = "block";

    try {
        geoJSONLayers.forEach(function(layer) {
            map.removeLayer(layer);
        });
        geoJSONLayers = [];

        const response = await fetch('./INDIA_DISTRICTS.geojson', { signal });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const data = await response.json();

        let previousColor = null;
        let previousResult = null
        for (var i = 0; i < data['features'].length; i++) {
            var districtID = data['features'][i].id;
            try {
                var [colourVal, colourResult] = await determineColour(districtID, dateNumber, signal);
                console.log("ColourVal: " + colourVal);

                if (colourVal != null) {
                    var layer = L.geoJSON(data['features'][i], {
                        style: function () {
                            var layerColor = (colourVal === 'black' && previousColor) ? previousColor : colourVal;
                            var colourResult = (colourVal === 'black' && previousColor) ? previousResult : colourResult;
                            previousColor = layerColor;
                            previousResult = colourResult
                            return {
                                color: 'black',
                                weight: document.getElementById('colourOpacitySlider').value,
                                fillColor: layerColor,
                                fillOpacity: document.getElementById('colourOpacitySlider').value
                            };
                        }
                    });
                    layer.bindPopup("<b>" + "Fire Probability: " + parseInt(colourResult * 10) + "</b><br>");
                }

                layer.addTo(map);
                geoJSONLayers.push(layer);

            } catch (error) {
                console.error("Error determining color for district:", error);
            }
        }

        document.getElementById('spinnerCircle').style.display = "none";
        document.getElementById('background').style.display = "none";
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch request was aborted');
        } else {
            console.error('Error fetching or processing the data:', error);
        }
    }
}

loadDistrictLayers(0);
document.getElementById('colourDateLabel').innerText = `Forecast Date: ` +  getDateRange(0);

document.getElementById('colourOpacitySlider').addEventListener('input', function(e) {
    var opacityValue = e.target.value;

    geoJSONLayers.forEach(function(layer) {
        layer.setStyle({
            weight: opacityValue,
            fillOpacity: opacityValue
        });
    });
});

document.getElementById('colourDateSlider').addEventListener('input', function(e) {
    var dateValue = parseInt(e.target.value);

    console.log(dateValue);

    document.getElementById('colourDateLabel').innerText = `Forecast Date: ` +  getDateRange(dateValue);

    loadDistrictLayers(dateValue);
});

var geocoder = L.Control.Geocoder.nominatim();

async function validateLocation() {
    document.getElementById('spinnerCircle').style.display = "block";
    document.getElementById('locationInputOpen').click();

    var location = document.getElementById('locationSearch').value;

    if (location.trim() === "") {
        alert("Please enter a location");
        document.getElementById('spinnerCircle').style.display = "none";
        return;
    }

    try {
        const results = await geocodeLocation(location);

        if (results.length > 0) {
            var result = results[0];
            map.setView(result.center, 13);

            geoJSONLayers.forEach(function(layer) {
                layer.setStyle({
                    weight: 0.2,
                    fillOpacity: 0.2
                });
            });

            document.getElementById('colourOpacitySlider').value = 0.2;
            var lat = result.center.lat;
            var lng = result.center.lng;
            
            const predictionNumber = await runModelPrediction(lat, lng);

            var popupContent = "Location: " + result.name + "<br><br>" +
                               "Latitude: " + lat.toFixed(6) + "<br>" +
                               "Longitude: " + lng.toFixed(6) + "<br><br>" +
                               "Forest Fire Prediction:- " + "<br>" +
                                predictionNumber[0] + "%";
    
            L.marker(result.center).addTo(map)
                .bindPopup(popupContent)
                .openPopup();
            
            document.getElementById('spinnerCircle').style.display = "none";
        } else {
            alert("Invalid location entered. Please try again.");
            document.getElementById('spinnerCircle').style.display = "none";
        }
    } catch (error) {
        console.log("Error:", error);
        alert("An error occurred while processing the location. Please try again.");
        document.getElementById('spinnerCircle').style.display = "none";
    }
}

async function validateLocationNav() {
    document.getElementById('spinnerCircle').style.display = "block";

    var location = document.getElementById('locationSearchNav').value;

    if (location.trim() === "") {
        alert("Please enter a location");
        document.getElementById('spinnerCircle').style.display = "none";
        return;
    }

    try {
        const results = await geocodeLocation(location);

        if (results.length > 0) {
            var result = results[0];
            map.setView(result.center, 13);

            geoJSONLayers.forEach(function(layer) {
                layer.setStyle({
                    weight: 0.2,
                    fillOpacity: 0.2
                });
            });

            document.getElementById('colourOpacitySlider').value = 0.2;
            var lat = result.center.lat;
            var lng = result.center.lng;
            
            const predictionNumber = await runModelPrediction(lat, lng);

            var popupContent = "Location: " + result.name + "<br><br>" +
                               "Latitude: " + lat.toFixed(6) + "<br>" +
                               "Longitude: " + lng.toFixed(6) + "<br><br>" +
                               "Forest Fire Prediction:- " + "<br>" +
                                predictionNumber[0] + "%";
    
            L.marker(result.center).addTo(map)
                .bindPopup(popupContent)
                .openPopup();
            
            document.getElementById('spinnerCircle').style.display = "none";
        } else {
            alert("Invalid location entered. Please try again.");
            document.getElementById('spinnerCircle').style.display = "none";
        }
    } catch (error) {
        console.log("Error:", error);
        alert("An error occurred while processing the location. Please try again.");
        document.getElementById('spinnerCircle').style.display = "none";
    }
}

async function geocodeLocation(location) {
    return new Promise((resolve, reject) => {
        geocoder.geocode(location, function(results) {
            if (results && results.length > 0) {
                resolve(results);
            } else {
                reject("No results found.");
            }
        });
    });
}


document.getElementById("searchLocationForm").addEventListener("submit", function(event) {
    event.preventDefault();
    validateLocation();
});

document.getElementById("searchLocationFormNav").addEventListener("submit", function(event) {
    event.preventDefault();
    validateLocationNav();
});


async function searchLocation(query) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
    const results = await response.json();
    return results;
}

const input = document.getElementById('locationSearch');

input.addEventListener('input', async () => {
    const query = input.value;
    const suggestionBox = document.getElementById('suggestions');

    document.getElementById('suggestions').style.display = "none";
    if (query.length < 3) return;

    document.getElementById('suggestions').style.display = "block";

    try {
        const results = await searchLocation(query);
        suggestionBox.innerHTML = '';

        results.forEach(result => {
            const suggestion = document.createElement('div');
            suggestion.textContent = result.display_name;
            suggestion.style.cursor = 'pointer';
            suggestion.addEventListener('click', async () => {
                document.getElementById('spinnerCircle').style.display = "block";

                document.getElementById('suggestions').style.display = "none";
        
                geoJSONLayers.forEach(function(layer) {
                    layer.setStyle({
                        weight: 0.2,
                        fillOpacity: 0.2
                    });
                });

                document.getElementById('colourOpacitySlider').value = 0.2;

                document.getElementById('locationInputOpen').click();
                input.value = result.display_name;
                map.setView([result.lat, result.lon], 10);

                try {
                    const predictionNumber = await runModelPrediction(parseFloat(result.lat), parseFloat(result.lon));

                    if (predictionNumber && predictionNumber.length > 0) {
                        const popupContent =    "Location: " + result.display_name + "<br><br>" +
                                                "Latitude: " + parseFloat(result.lat).toFixed(6) + "<br>" +
                                                "Longitude: " + parseFloat(result.lon).toFixed(6) + "<br><br>" +
                                                "Forest Fire Prediction:- " + "<br>" +
                                                predictionNumber[0] + "%";

                        L.marker([result.lat, result.lon]).addTo(map).bindPopup(popupContent).openPopup();
                        document.getElementById('spinnerCircle').style.display = "none";
                    } else {
                        console.log("No prediction data available.");
                    }

                    suggestionBox.innerHTML = '';
                } catch (error) {
                    console.log("Error in Prediction.", error);
                }
            });
            suggestionBox.appendChild(suggestion);
        });
    } catch (error) {
        console.log("Error fetching location results.", error);
    }
});

document.getElementById('background').addEventListener('click', function(event) {
    document.getElementById('locationInputOpen').click();
});

document.getElementById('backgroundNavbar').addEventListener('click', function(event) {
    document.getElementById('navbarToggle').click();
});

document.getElementById('locationInputOpen').addEventListener('click', function(event) {
    if(document.getElementById('background').style.display == 'block'){
        document.getElementById('background').style.display = 'none';
    } else {
        document.getElementById('background').style.display = 'block';
    }
});

document.getElementById('navbarToggle').addEventListener('click', function(event) {
    if(document.getElementById('backgroundNavbar').style.display == 'block'){
        document.getElementById('backgroundNavbar').style.display = 'none';
    } else {
        document.getElementById('backgroundNavbar').style.display = 'block';
    }
});