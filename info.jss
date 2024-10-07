// Wait for the document to load or add an event listener if it hasn't yet
function onDocumentReady() {
    if (document.readyState !== "loading") {
        console.log("Document is ready!");
        fetchJSON();
    } else {
        document.addEventListener("DOMContentLoaded", () => {
            console.log("Document is currently loading!");
            fetchJSON();
        });
    }
}

// Fetch geoJSON data and initialize the map
async function fetchJSON() {
    try {
        const url = "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326";
        const response = await fetch(url);
        const data = await response.json();
        await initializeMap(data);
    } catch (error) {
        console.error("Error fetching geoJSON data:", error);
    }
}

// Fetch migration data
async function fetchMigration() {
    try {
        const positiveUrl = "https://statfin.stat.fi/PxWeb/sq/4bb2c735-1dc3-4c5e-bde7-2165df85e65f";
        const negativeUrl = "https://statfin.stat.fi/PxWeb/sq/944493ca-ea4d-4fd9-a75c-4975192f7b6e";

        const [positiveResponse, negativeResponse] = await Promise.all([
            fetch(positiveUrl),
            fetch(negativeUrl)
        ]);
        
        const positiveDataset = await positiveResponse.json();
        const negativeDataset = await negativeResponse.json();

        return {
            pd_indexes: positiveDataset.dataset.dimension.Tuloalue.category.index,
            pd_values: positiveDataset.dataset.value,
            nd_indexes: Object.values(negativeDataset.dataset.dimension)[0].category.index,
            nd_values: negativeDataset.dataset.value,
        };
    } catch (error) {
        console.error("Error fetching migration data:", error);
    }
}

// Calculate color based on migration values
function calculateColor(positiveMigration, negativeMigration) {
    const ratio = positiveMigration / negativeMigration;
    const hue = Math.min(Math.pow(ratio, 3) * 60, 120);
    return `hsl(${hue}, 75%, 50%)`;
}

// Initialize the map and display geoJSON and migration data
async function initializeMap(data) {
    const map = L.map('map').setView([65.0121, 25.4651], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        minZoom: -3,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const migrationData = await fetchMigration();
    const geoJSON = L.geoJSON(data, {
        weight: 2,
        onEachFeature: function (feature, layer) {
            const kuntaCode = feature.properties.kunta;
            const positiveMigration = migrationData.pd_values[migrationData.pd_indexes["KU" + kuntaCode]] || 0;
            const negativeMigration = migrationData.nd_values[migrationData.nd_indexes["KU" + kuntaCode]] || 0;

            layer.bindTooltip(layer.feature.properties.nimi);
            layer.on('click', function () {
                layer.bindPopup(`<b>${feature.properties.nimi}</b><br>Positive Migration: ${positiveMigration}<br>Negative Migration: ${negativeMigration}`).openPopup();
            });
            const color = calculateColor(positiveMigration, negativeMigration);
            layer.setStyle({
                fillColor: color,
                color: color
            });
        }
    }).addTo(map);
    map.fitBounds(geoJSON.getBounds());
}

// Call the function to check document readiness
onDocumentReady();
