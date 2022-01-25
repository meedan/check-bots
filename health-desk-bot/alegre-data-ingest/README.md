# Health Desk Bot

A bot to look up Health Desk content via text similarity queries

## Usage

### Indexing Health Desk content from CSV file in Alegre

* Run `node ingest-csv.js <csv-file>`

Make sure that `SIMILARITY_MODEL` and `ALEGRE_ENDPOINT` are well adjusted to the right model and Alegre instance in `ingest-csv.js`.
