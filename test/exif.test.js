var assert = require('assert');
var { getMetadata, getGeolocation } = require('../exif');

describe('EXIF bot tests', function () {
  it('should extract the correct metadata from an image', async function () {
    var metadata = await getMetadata('http://bots:7777/IMG_1994.jpg');
    assert.deepEqual(metadata, {
      make: 'Apple',
      model: 'iPhone XR',
      software: 'Photos 4.0',
      date: '2019:02:15 13:21:20'
    });
  });

  it('should fail gracefully when an image is not found', async function () {
    var metadata = await getMetadata('http://kofta');
    assert.deepEqual(metadata, {
      make: 'Not found',
      model: 'Not found',
      software: 'Not found',
      date: 'Not found'
    });
    var metadata1 = await getMetadata('http://bots:7777/IMG_1995.jpg');
    assert.deepEqual(metadata1, {
      make: 'Not found',
      model: 'Not found',
      software: 'Not found',
      date: 'Not found'
    });
  });

  it('should extract the correct GeoJSON information from an image', async function () {
    var geojson = await getGeolocation('https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/gps/DSCN0010.jpg');
    assert.deepEqual(geojson, {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [43.46744833333334, 11.885126666663888]
      },
      properties: {
        name: "Arezzo, Tuscany, Italy"
      }
    });
  });

  it('should throw error when no GeoJSON information is found', async function () {
    var geojson = await getGeolocation('http://bots:7777/IMG_1994.jpg').catch(error => {
      assert.equal(error.message, 'No GPS information found');
    });
    assert.equal(geojson, undefined);
  });
});
