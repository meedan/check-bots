const fs = require('fs');
const csv = require('csv-parse/sync');
const md5 = require('crypto-js/md5');
const axios = require('axios');
const config = require('./config.js');

const SIMILARITY_MODEL = config.similarityModel;
const ALEGRE_ENDPOINT = config.alegreEndpoint;

const args = process.argv.slice(2);
const stream = fs.createReadStream(args[0]);

const postDataToAlegre = (payload) => {
  axios
  .post(ALEGRE_ENDPOINT, payload)
  .then(res => console.log(`Status: ${res.status}`))
  .catch(error => console.error(error));
};

stream.on('data', (data) => {
  const records = csv.parse(data.toString());

  records.forEach((row, rowIndex) => {
    if (rowIndex > 0) {
      const context = { health_desk: true };

      row.forEach((col, colIndex) => {
        const header = records[0][colIndex].toLowerCase();
        context[header] = col;
      });

      row.forEach((col, colIndex) => {
        const header = records[0][colIndex].toLowerCase();
        if (header !== 'url') {
          context.field = header;

          postDataToAlegre({
            doc_id: md5(col).toString(),
            text: col,
            model: SIMILARITY_MODEL,
            context,
          });
        }
      });
    }
  });
});
