/* =====================================================
   HIGHFIELDS ILLEGAL DUMPSITE GIS DASHBOARD
===================================================== */


/* =====================================================
   CONFIGURATION
===================================================== */

const CONFIG = {

    boundaryFile:
        "data/highfields_boundary.geojson",

    dumpsitesFile:
        "data/dumpsites.geojson",

    /*
       IMPORTANT:

       The application tries to automatically find your
       classification field.

       If your dumpsite GeoJSON has a field such as:

       "class"
       "classification"
       "severity"
       "risk"
       "risk_level"

       it will detect it automatically.

       If automatic detection fails, put the EXACT
       property name here.

       Example:

       classificationField: "severity"

       For now leave it as null.
    */

    classificationField: null

};


/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let map;

let boundaryLayer;

let allDumpsites;

let allDumpsiteFeatures = [];

let classLayers = {};

let classificationField = null;

let classificationChart;


/* =====================================================
   INITIALIZE
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeMap();

        loadBoundary();

        loadDumpsites();

        setupInterface();

    }
);


/* =====================================================
   MAP
===================================================== */

function initializeMap() {

    map = L.map("map", {

        center: [
            -17.90,
            30.98
        ],

        zoom: 13

    });


    /* -----------------------------------------------
       OPENSTREETMAP
    ------------------------------------------------ */

    const osm = L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            maxZoom: 19,

            attribution:
                "&copy; OpenStreetMap contributors"

        }

    );


    /* -----------------------------------------------
       SATELLITE
    ------------------------------------------------ */

    const satellite = L.tileLayer(

        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

        {

            attribution:
                "Tiles &copy; Esri"

        }

    );


    osm.addTo(map);


    L.control.layers(

        {

            "OpenStreetMap": osm,

            "Satellite": satellite

        },

        null,

        {

            position: "topright",

            collapsed: false

        }

    ).addTo(map);


    L.control.scale({

        imperial: false

    }).addTo(map);

}


/* =====================================================
   LOAD BOUNDARY
===================================================== */

async function loadBoundary() {

    try {

        const response =
            await fetch(
                CONFIG.boundaryFile
            );


        if (!response.ok) {

            throw new Error(
                "Boundary file could not be loaded."
            );

        }


        const data =
            await response.json();


        console.log(
            "Boundary GeoJSON:",
            data
        );


        boundaryLayer =
            L.geoJSON(

                data,

                {

                    style: {

                        color: "#111111",

                        weight: 3,

                        fillColor: "#4caf50",

                        fillOpacity: 0.12

                    }

                }

            );


        boundaryLayer.addTo(map);


        if (
            boundaryLayer
            .getBounds()
            .isValid()
        ) {

            map.fitBounds(

                boundaryLayer.getBounds(),

                {

                    padding: [20, 20]

                }

            );

        }


        createLayerInterface();

    }

    catch (error) {

        console.error(error);

        showMapError(
            "Could not load the Highfields boundary. Check the filename and data folder."
        );

    }

}


/* =====================================================
   LOAD DUMPSITES
===================================================== */

async function loadDumpsites() {

    try {

        const response =
            await fetch(
                CONFIG.dumpsitesFile
            );


        if (!response.ok) {

            throw new Error(
                "Dumpsites file could not be loaded."
            );

        }


        allDumpsites =
            await response.json();


        console.log(
            "Dumpsites GeoJSON:",
            allDumpsites
        );


        allDumpsiteFeatures =
            allDumpsites.features || [];


        if (
            allDumpsiteFeatures.length === 0
        ) {

            throw new Error(
                "The dumpsites GeoJSON contains no features."
            );

        }


        /* ------------------------------------------
           FIND CLASSIFICATION FIELD
        ------------------------------------------- */

        classificationField =
            findClassificationField(
                allDumpsiteFeatures
            );


        console.log(
            "Classification field:",
            classificationField
        );


        /* ------------------------------------------
           CREATE DUMPSITE LAYERS
        ------------------------------------------- */

        createClassificationLayers();


        /* ------------------------------------------
           STATISTICS
        ------------------------------------------- */

        updateStatistics();


        /* ------------------------------------------
           CHART
        ------------------------------------------- */

        createClassificationChart();


        /* ------------------------------------------
           SUMMARY
        ------------------------------------------- */

        createClassificationSummary();


        /* ------------------------------------------
           SEARCH
        ------------------------------------------- */

        setupSearch();


        /* ------------------------------------------
           LAYER INTERFACE
        ------------------------------------------- */

        createLayerInterface();

    }

    catch (error) {

        console.error(error);

        showMapError(
            "Could not load the illegal dumpsites GeoJSON. Check the file and its structure."
        );

    }

}


/* =====================================================
   FIND CLASSIFICATION FIELD
===================================================== */

function findClassificationField(
    features
) {

    /* -----------------------------------------------
       USER DEFINED FIELD
    ------------------------------------------------ */

    if (
        CONFIG.classificationField
    ) {

        return CONFIG.classificationField;

    }


    const possibleNames = [

        "classification",

        "class",

        "class_name",

        "className",

        "category",

        "severity",

        "severity_level",

        "severityLevel",

        "risk",

        "risk_level",

        "riskLevel",

        "risk_class",

        "risk_classification",

        "level"

    ];


    const properties =
        features[0].properties || {};


    /* -----------------------------------------------
       EXACT MATCH
    ------------------------------------------------ */

    for (
        const name of possibleNames
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                properties,
                name
            )
        ) {

            return name;

        }

    }


    /* -----------------------------------------------
       CASE-INSENSITIVE MATCH
    ------------------------------------------------ */

    const propertyKeys =
        Object.keys(properties);


    for (
        const possible of possibleNames
    ) {

        const found =
            propertyKeys.find(

                key =>
                    key.toLowerCase()
                    === possible.toLowerCase()

            );


        if (found) {

            return found;

        }

    }


    /* -----------------------------------------------
       SEARCH FOR PARTIAL MATCH
    ------------------------------------------------ */

    const partial =
        propertyKeys.find(

            key => {

                const lower =
                    key.toLowerCase();

                return (

                    lower.includes("class") ||

                    lower.includes("severity") ||

                    lower.includes("risk") ||

                    lower.includes("category")

                );

            }

        );


    return partial || null;

}


/* =====================================================
   CREATE CLASSIFICATION LAYERS
===================================================== */

function createClassificationLayers() {

    classLayers = {};


    /* -----------------------------------------------
       GET UNIQUE CLASSES
    ------------------------------------------------ */

    const classes = [];


    allDumpsiteFeatures.forEach(

        feature => {

            const properties =
                feature.properties || {};


            let value =
                "Unclassified";


            if (
                classificationField &&
                properties[
                    classificationField
                ] !== undefined &&
                properties[
                    classificationField
                ] !== null
            ) {

                value =
                    String(
                        properties[
                            classificationField
                        ]
                    ).trim();

            }


            if (
                value === ""
            ) {

                value =
                    "Unclassified";

            }


            if (
                !classes.includes(value)
            ) {

                classes.push(value);

            }

        }

    );


    /* -----------------------------------------------
       SORT CLASSES
    ------------------------------------------------ */

    classes.sort();


    /* -----------------------------------------------
       CREATE ALL DUMPSITES LAYER
    ------------------------------------------------ */

    const allLayer =
        createLayerFromFeatures(
            allDumpsiteFeatures
        );


    allLayer.addTo(map);


    classLayers[
        "__ALL__"
    ] = {

        name:
            "All Dumpsites",

        layer:
            allLayer,

        color:
            "#d32f2f"

    };


    /* -----------------------------------------------
       CREATE EACH CLASS LAYER
    ------------------------------------------------ */

    classes.forEach(

        (className, index) => {

            const filtered =
                allDumpsiteFeatures.filter(

                    feature => {

                        const properties =
                            feature.properties || {};


                        let value =
                            "Unclassified";


                        if (
                            classificationField &&
                            properties[
                                classificationField
                            ] !== undefined
                        ) {

                            value =
                                String(
                                    properties[
                                        classificationField
                                    ]
                                ).trim();

                        }


                        return value === className;

                    }

                );


            const layer =
                createLayerFromFeatures(
                    filtered
                );


            const color =
                getClassColor(
                    className,
                    index
                );


            classLayers[
                className
            ] = {

                name:
                    className,

                layer:
                    layer,

                color:
                    color

            };

        }

    );


    console.log(
        "Classification layers:",
        classLayers
    );

}


/* =====================================================
   CREATE GEOJSON LAYER
===================================================== */

function createLayerFromFeatures(
    features
) {

    const group =
        L.layerGroup();


    features.forEach(

        feature => {

            if (
                !feature.geometry
            ) {

                return;

            }


            /* ---------------------------------------
               POINT GEOMETRY
            ---------------------------------------- */

            if (
                feature.geometry.type
                === "Point"
            ) {

                const coordinates =
                    feature.geometry.coordinates;


                const longitude =
                    coordinates[0];


                const latitude =
                    coordinates[1];


                const marker =
                    createMarker(

                        feature,

                        [
                            latitude,
                            longitude
                        ]

                    );


                group.addLayer(
                    marker
                );

            }


            /* ---------------------------------------
               MULTIPOINT
            ---------------------------------------- */

            else if (
                feature.geometry.type
                === "MultiPoint"
            ) {

                feature.geometry.coordinates
                    .forEach(

                        coordinates => {

                            const marker =
                                createMarker(

                                    feature,

                                    [

                                        coordinates[1],

                                        coordinates[0]

                                    ]

                                );


                            group.addLayer(
                                marker
                            );

                        }

                    );

            }

        }

    );


    return group;

}


/* =====================================================
   CREATE MARKER
===================================================== */

function createMarker(
    feature,
    coordinates
) {

    const properties =
        feature.properties || {};


    const classValue =
        classificationField
            ? properties[
                classificationField
              ]
            : "Unclassified";


    const color =
        getClassColor(
            String(
                classValue ||
                "Unclassified"
            ),
            0
        );


    const marker =
        L.circleMarker(

            coordinates,

            {

                radius: 8,

                fillColor:
                    color,

                color:
                    "#ffffff",

                weight:
                    2,

                opacity:
                    1,

                fillOpacity:
                    0.9

            }

        );


    /* -----------------------------------------------
       POPUP
    ------------------------------------------------ */

    marker.bindPopup(

        createPopup(
            properties
        ),

        {

            maxWidth:
                380

        }

    );


    /* -----------------------------------------------
       CLICK
    ------------------------------------------------ */

    marker.on(

        "click",

        function () {

            displaySelectedSite(
                properties
            );

        }

    );


    return marker;

}


/* =====================================================
   POPUP
===================================================== */

function createPopup(
    properties
) {

    let html = `

        <div>

            <h3 class="popup-title">

                Illegal Dumpsite

            </h3>

            <table class="popup-table">

    `;


    Object.entries(
        properties
    )
    .forEach(

        ([key, value]) => {

            html += `

                <tr>

                    <td>
                        ${formatName(key)}
                    </td>

                    <td>
                        ${formatValue(value)}
                    </td>

                </tr>

            `;

        }

    );


    html += `

            </table>

        </div>

    `;


    return html;

}


/* =====================================================
   CREATE LAYER INTERFACE
===================================================== */

function createLayerInterface() {

    const container =
        document.getElementById(
            "layerList"
        );


    if (
        !container
    ) {

        return;

    }


    container.innerHTML = "";


    /* -----------------------------------------------
       BOUNDARY
    ------------------------------------------------ */

    if (
        boundaryLayer
    ) {

        createLayerCheckbox(

            container,

            "Highfields Boundary",

            boundaryLayer,

            "#1b1b1b",

            true,

            true

        );

    }


    /* -----------------------------------------------
       ALL DUMPSITES
    ------------------------------------------------ */

    if (
        classLayers[
            "__ALL__"
        ]
    ) {

        createLayerCheckbox(

            container,

            "All Dumpsites",

            classLayers[
                "__ALL__"
            ].layer,

            "#d32f2f",

            true,

            true

        );

    }


    /* -----------------------------------------------
       CLASSIFICATION HEADING
    ------------------------------------------------ */

    if (
        Object.keys(
            classLayers
        ).length > 1
    ) {

        const heading =
            document.createElement(
                "div"
            );


        heading.style.marginTop =
            "12px";


        heading.style.fontWeight =
            "bold";


        heading.style.fontSize =
            "11px";


        heading.style.color =
            "#78909c";


        heading.textContent =
            "DUMPSITE CLASSES";


        container.appendChild(
            heading
        );

    }


    /* -----------------------------------------------
       EACH CLASS
    ------------------------------------------------ */

    Object.entries(
        classLayers
    )
    .forEach(

        ([key, object]) => {

            if (
                key === "__ALL__"
            ) {

                return;

            }


            createLayerCheckbox(

                container,

                object.name,

                object.layer,

                object.color,

                false,

                false

            );

        }

    );

}


/* =====================================================
   LAYER CHECKBOX
===================================================== */

function createLayerCheckbox(

    container,

    name,

    layer,

    color,

    checked,

    isBaseLayer

) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "layer-item";


    const checkbox =
        document.createElement(
            "input"
        );


    checkbox.type =
        "checkbox";


    checkbox.checked =
        checked;


    const symbol =
        document.createElement(
            "span"
        );


    if (
        isBaseLayer &&
        name === "Highfields Boundary"
    ) {

        symbol.className =
            "boundary-color";

    }

    else {

        symbol.className =
            "layer-color";


        symbol.style.backgroundColor =
            color;

    }


    const label =
        document.createElement(
            "span"
        );


    label.textContent =
        name;


    row.appendChild(
        checkbox
    );


    row.appendChild(
        symbol
    );


    row.appendChild(
        label
    );


    container.appendChild(
        row
    );


    checkbox.addEventListener(

        "change",

        function () {

            if (
                this.checked
            ) {

                layer.addTo(
                    map
                );

            }

            else {

                map.removeLayer(
                    layer
                );

            }

        }

    );

}


/* =====================================================
   CLASS COLOURS
===================================================== */

function getClassColor(
    className,
    index
) {

    const value =
        String(
            className
        )
        .toLowerCase();


    /* -----------------------------------------------
       RISK-BASED COLOURS
    ------------------------------------------------ */

    if (
        value.includes(
            "very high"
        ) ||
        value.includes(
            "veryhigh"
        )
    ) {

        return "#7b1fa2";

    }


    if (
        value === "high" ||
        value.includes("high")
    ) {

        return "#d32f2f";

    }


    if (
        value.includes(
            "moderate"
        ) ||
        value.includes(
            "medium"
        )
    ) {

        return "#f57c00";

    }


    if (
        value.includes(
            "low"
        )
    ) {

        return "#388e3c";

    }


    /* -----------------------------------------------
       DEFAULT COLOUR PALETTE
    ------------------------------------------------ */

    const colors = [

        "#1976d2",

        "#0097a7",

        "#8e24aa",

        "#6d4c41",

        "#546e7a",

        "#00897b",

        "#3949ab",

        "#c2185b"

    ];


    return colors[
        index % colors.length
    ];

}


/* =====================================================
   STATISTICS
===================================================== */

function updateStatistics() {

    const total =
        allDumpsiteFeatures.length;


    let high =
        0;

    let moderate =
        0;

    let low =
        0;


    allDumpsiteFeatures.forEach(

        feature => {

            const properties =
                feature.properties || {};


            const value =
                classificationField
                    ? String(
                        properties[
                            classificationField
                        ] ||
                        ""
                    ).toLowerCase()
                    : "";


            if (
                value.includes(
                    "high"
                )
            ) {

                high++;

            }


            if (
                value.includes(
                    "moderate"
                ) ||
                value.includes(
                    "medium"
                )
            ) {

                moderate++;

            }


            if (
                value.includes(
                    "low"
                )
            ) {

                low++;

            }

        }

    );


    document.getElementById(
        "totalSites"
    ).textContent =
        total;


    document.getElementById(
        "highRiskSites"
    ).textContent =
        high;


    document.getElementById(
        "moderateSites"
    ).textContent =
        moderate;


    document.getElementById(
        "lowSites"
    ).textContent =
        low;

}


/* =====================================================
   CHART
===================================================== */

function createClassificationChart() {

    const counts = {};


    allDumpsiteFeatures.forEach(

        feature => {

            const properties =
                feature.properties || {};


            let value =
                "Unclassified";


            if (
                classificationField
            ) {

                value =
                    String(
                        properties[
                            classificationField
                        ] ||
                        "Unclassified"
                    );

            }


            counts[value] =
                (
                    counts[value] ||
                    0
                ) + 1;

        }

    );


    const labels =
        Object.keys(
            counts
        );


    const values =
        Object.values(
            counts
        );


    const colors =
        labels.map(

            (label, index) => {

                return getClassColor(
                    label,
                    index
                );

            }

        );


    const canvas =
        document.getElementById(
            "classificationChart"
        );


    classificationChart =
        new Chart(

            canvas,

            {

                type:
                    "doughnut",

                data: {

                    labels:
                        labels,

                    datasets: [

                        {

                            data:
                                values,

                            backgroundColor:
                                colors,

                            borderColor:
                                "#ffffff",

                            borderWidth:
                                2

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        }

                    }

                }

            }

        );

}


/* =====================================================
   CLASSIFICATION SUMMARY
===================================================== */

function createClassificationSummary() {

    const container =
        document.getElementById(
            "classificationSummary"
        );


    const counts = {};


    allDumpsiteFeatures.forEach(

        feature => {

            const properties =
                feature.properties || {};


            let value =
                "Unclassified";


            if (
                classificationField
            ) {

                value =
                    String(
                        properties[
                            classificationField
                        ] ||
                        "Unclassified"
                    );

            }


            counts[value] =
                (
                    counts[value] ||
                    0
                ) + 1;

        }

    );


    container.innerHTML = "";


    Object.entries(
        counts
    )
    .forEach(

        ([name, count], index) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "summary-row";


            const left =
                document.createElement(
                    "div"
                );


            left.className =
                "summary-left";


            const dot =
                document.createElement(
                    "span"
                );


            dot.className =
                "layer-color";


            dot.style.backgroundColor =
                getClassColor(
                    name,
                    index
                );


            const label =
                document.createElement(
                    "span"
                );


            label.textContent =
                name;


            const number =
                document.createElement(
                    "span"
                );


            number.className =
                "summary-number";


            number.textContent =
                count;


            left.appendChild(
                dot
            );


            left.appendChild(
                label
            );


            row.appendChild(
                left
            );


            row.appendChild(
                number
            );


            container.appendChild(
                row
            );

        }

    );

}


/* =====================================================
   SELECTED SITE
===================================================== */

function displaySelectedSite(
    properties
) {

    const container =
        document.getElementById(
            "selectedSite"
        );


    container.innerHTML = "";


    Object.entries(
        properties
    )
    .forEach(

        ([key, value]) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "site-row";


            const keyElement =
                document.createElement(
                    "span"
                );


            keyElement.className =
                "site-key";


            keyElement.textContent =
                formatName(key);


            const valueElement =
                document.createElement(
                    "span"
                );


            valueElement.className =
                "site-value";


            valueElement.textContent =
                formatValue(value);


            row.appendChild(
                keyElement
            );


            row.appendChild(
                valueElement
            );


            container.appendChild(
                row
            );

        }

    );

}


/* =====================================================
   SEARCH
===================================================== */

function setupSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );


    input.addEventListener(

        "input",

        function () {

            const query =
                this.value
                .trim()
                .toLowerCase();


            if (
                query === ""
            ) {

                showAllSearchResults();

                return;

            }


            allDumpsiteFeatures.forEach(

                feature => {

                    const properties =
                        feature.properties || {};


                    const text =
                        JSON.stringify(
                            properties
                        )
                        .toLowerCase();


                    if (
                        text.includes(
                            query
                        )
                    ) {

                        zoomToFeature(
                            feature
                        );

                    }

                }

            );

        }

    );


    document.getElementById(
        "resetSearch"
    )
    .addEventListener(

        "click",

        function () {

            input.value = "";

            showAllSearchResults();

        }

    );

}


/* =====================================================
   ZOOM TO FEATURE
===================================================== */

function zoomToFeature(
    feature
) {

    if (
        !feature.geometry
    ) {

        return;

    }


    if (
        feature.geometry.type
        === "Point"
    ) {

        const coordinates =
            feature.geometry.coordinates;


        map.setView(

            [
                coordinates[1],
                coordinates[0]
            ],

            17

        );

    }

}


/* =====================================================
   SEARCH RESET
===================================================== */

function showAllSearchResults() {

    if (
        boundaryLayer &&
        boundaryLayer.getBounds().isValid()
    ) {

        map.fitBounds(

            boundaryLayer.getBounds(),

            {

                padding: [20,20]

            }

        );

    }

}


/* =====================================================
   BUTTONS
===================================================== */

function setupInterface() {

    document.getElementById(
        "zoomBoundary"
    )
    .addEventListener(

        "click",

        function () {

            if (
                boundaryLayer &&
                boundaryLayer
                    .getBounds()
                    .isValid()
            ) {

                map.fitBounds(

                    boundaryLayer.getBounds(),

                    {

                        padding:
                            [20,20]

                    }

                );

            }

        }

    );

}


/* =====================================================
   FORMAT FIELD NAME
===================================================== */

function formatName(
    value
) {

    return String(value)

        .replace(
            /_/g,
            " "
        )

        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


/* =====================================================
   FORMAT VALUE
===================================================== */

function formatValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "Not recorded";

    }


    if (
        typeof value === "object"
    ) {

        return JSON.stringify(
            value
        );

    }


    return String(value);

}


/* =====================================================
   ERROR MESSAGE
===================================================== */

function showMapError(
    message
) {

    const mapElement =
        document.getElementById(
            "map"
        );


    mapElement.innerHTML = `

        <div style="
            padding:40px;
            text-align:center;
            color:#b71c1c;
            font-family:Arial;
        ">

            <h3>
                GIS Data Error
            </h3>

            <p>
                ${message}
            </p>

            <p>
                Open the browser developer console
                to see the technical error.
            </p>

        </div>

    `;

}