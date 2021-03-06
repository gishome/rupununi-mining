var L = require('leaflet')
// L.Hash
require('leaflet-hash')
// L.Control.Fullscreen
require('leaflet-fullscreen')
var MiniMap = require('leaflet-minimap')
var SideBySide = require('leaflet-side-by-side')
var assign = require('object-assign')
var pluck = require('lodash.pluck')
var find = require('lodash.find')
var debounce = require('lodash.debounce')

var satelliteLayer = require('./satellite-layer')
var LayerControl = require('./layer-control')
var layerDefs = require('./layers.json')
var formatRelativeName = require('./formats').formatRelativeName
var formatName = require('./formats').formatName

var interestArea = [
  [2.115, -59.28],
  [2.345, -59.05]
]
var bounds = L.latLngBounds(interestArea)

var map = global.map = L.map('map', {
  maxBounds: bounds,
  maxZoom: 18,
  minZoom: 12,
  zoomControl: false
}).fitBounds(bounds)
map.attributionControl.setPrefix()

// Keep the URL updated with a hash of the current position
L.hash(map)

// L.rectangle(interestArea, {color: '#FFC107', weight: 2, fill: false}).addTo(map)

var leftLayers = addLayerToDefs(layerDefs)
var rightLayers = addLayerToDefs(layerDefs)

var leftControl = new LayerControl(leftLayers, {side: 'left'}).addTo(map)
var rightControl = new LayerControl(rightLayers, {side: 'right'}).addTo(map)

L.control.zoom({position: 'topright'}).addTo(map)
L.control.fullscreen({position: 'topright'}).addTo(map)

var mapboxUrl = 'https://api.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}@2x.png?access_token=pk.eyJ1IjoiZ21hY2xlbm5hbiIsImEiOiJSaWVtd2lRIn0.ASYMZE2HhwkAw4Vt7SavEg'
var mapboxLayer = new L.TileLayer(mapboxUrl, {minZoom: 3, maxZoom: 18})
if (map.getSize().x > 600) {
  new MiniMap(mapboxLayer, {
    zoomLevelOffset: -8,
    centerFixed: bounds.getCenter(),
    toggleDisplay: true,
    collapsedWidth: 26,
    collapsedHeight: 26
  }).addTo(map)
}
L.control.scale().addTo(map)

find(leftLayers, 'date', '2013-08-20').layer.addTo(map)
find(rightLayers, 'date', '2015-09-11').layer.addTo(map)

var sideBySide = new SideBySide(getLayers(leftLayers), getLayers(rightLayers), {padding: 50})

sideBySide.on('dividermove', function (e) {
  leftControl.setWidth(e.x - 2)
  rightControl.setWidth(map.getSize().x - e.x - 2)
})

map.on('layeradd', updateTitles)

var updateBingMeta = debounce(function (e) {
  var bingLayers = [
    find(leftLayers, 'id', 'bing'),
    find(rightLayers, 'id', 'bing')
  ]
  var zoom = map.getZoom()
  var mapSize = map.getSize()
  var latLng = map.containerPointToLatLng(L.point(sideBySide.getPosition(), mapSize.y / 2))
  bingLayers[0].layer.getMetaData(latLng, zoom).then(function (metadata) {
    bingLayers[0].date = bingLayers[1].date = metadata.resourceSets[0].resources[0].vintageEnd
    leftControl._update()
    rightControl._update()
    updateTitles()
  }).catch(console.log.bind(console))
}, 150)

map.on('move', updateBingMeta)
sideBySide.on('dividermove', updateBingMeta)

sideBySide.addTo(map)

updateTitles()
updateBingMeta()

function updateTitles () {
  var leftLayer = leftControl.getActiveBaseLayer()
  var rightLayer = rightControl.getActiveBaseLayer()
  leftControl.setTitle(formatRelativeName(leftLayer, rightLayer))
  rightControl.setTitle(formatName(rightLayer))
}

/* --- Helper functions --- */

/**
 * Takes an array of layer definitions
 * and returns the definitions with a new Leaflet.TileLayer assigned to the `layer` prop
 * @param {Object} layerDef
 */
function addLayerToDefs (layerDefs) {
  return layerDefs.map(function (layerDef) {
    var layer = satelliteLayer(layerDef)
    return assign({}, layerDef, {
      layer: layer
    })
  })
}

function getLayers (layerDefs) {
  return pluck(layerDefs, 'layer')
}
