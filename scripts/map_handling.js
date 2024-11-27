var map = L.map('map').setView([23, 80], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.zoomControl && map.removeControl(map.zoomControl);

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

document.querySelector('.leaflet-control-zoom').style.position = 'absolute';
document.querySelector('.leaflet-control-zoom').style.bottom = '100px';
document.querySelector('.leaflet-control-zoom').style.right = '50px';

var geoJSONLayers = [];

fetch('./INDIA_DISTRICTS.geojson')
.then(response => response.json())
.then(data => {
    for(var i = 0; i < data['features'].length; i++){
        var districtCentre = turf.centroid(data['features'][i])['geometry']['coordinates'];
        var colourIndex = predictFire(districtCentre);
        var colourVal;
        switch(colourIndex){
            case 0: colourVal = 'green'; break;
            case 1: colourVal = 'yellow'; break;
            case 2: colourVal = 'orange'; break;
            case 3: colourVal = 'red'; break;
        }
        
        var layer = L.geoJSON(data['features'][i], {
            style: function (feature) {
                return {
                    color: 'black',
                    weight: 0.5,
                    fillColor: colourVal,
                    fillOpacity: 0.5
                };
            }
        }).addTo(map);

        geoJSONLayers.push(layer);
    }
});

document.getElementById('colourOpacitySlider').addEventListener('input', function(e) {
    var opacityValue = e.target.value;

    geoJSONLayers.forEach(function(layer) {
        layer.setStyle({
            weight: opacityValue,
            fillOpacity: opacityValue
        });
    });
});

var geocoder = L.Control.Geocoder.nominatim();

// Function to handle search and validate location
function validateLocation() {
    document.getElementById('locationInputOpen').click();

    var location = document.getElementById('locationSearch').value;

    if (location.trim() === "") {
        alert("Please enter a location");
        return;
    }

    geocoder.geocode(location, function(results) {
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

            L.marker(result.center).addTo(map)
                .bindPopup("Location: " + result.name)
                .openPopup();
        } else {
            alert("Invalid location entered. Please try again.");
        }
    });
}

document.getElementById("searchLocationForm").addEventListener("submit", function(event) {
    event.preventDefault();
    validateLocation();
});

async function searchLocation(query) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
    const results = await response.json();
    return results;
}

const input = document.getElementById('locationSearch');

input.addEventListener('input', async () => {
    const query = input.value;
    document.getElementById('suggestions').style.display = "none";
    if (query.length < 3) return; // Wait for a few characters before fetching

    document.getElementById('suggestions').style.display = "block";

    const results = await searchLocation(query);
    const suggestionBox = document.getElementById('suggestions');

    // Clear previous suggestions
    suggestionBox.innerHTML = '';

    results.forEach(result => {
        const suggestion = document.createElement('div');
        suggestion.textContent = result.display_name;
        suggestion.style.cursor = 'pointer';
        // suggestion.tabIndex = "1"
        suggestion.addEventListener('click', () => {
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
            L.marker([result.lat, result.lon]).addTo(map).bindPopup(result.display_name).openPopup();
            suggestionBox.innerHTML = '';
        });
        suggestionBox.appendChild(suggestion);
    });
});

document.getElementById('background').addEventListener('click', function(event) {
    document.getElementById('locationInputOpen').click();
});

document.getElementById('locationInputOpen').addEventListener('click', function(event) {
    if(document.getElementById('background').style.display == 'block'){
        document.getElementById('background').style.display = 'none';
    } else {
        document.getElementById('background').style.display = 'block';
    }
});