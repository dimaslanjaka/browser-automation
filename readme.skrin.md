1. Modify `.env`

```conf
DATABASE_FILENAME="MEI"
MYSQL_DBNAME="MEI"
SPREADSHEET_ID="1pPlAh4-Z_HLPvhjAljsNgQfYs9jrS3AnFzfPoOMZ-4c"
skrin_username="<user>"
skrin_password="<pass>"
JSON_SECRET="<secret-key>"
VITE_JSON_SECRET="<secret-key>"
```

2. Download sheet

```bash
node download-google-sheet-csv.js
```

3. Run skrining

```bash
skrin
```

or using parallel

```bash
parallel launch
parallel skrin
```
