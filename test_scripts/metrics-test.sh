#!/bin/bash

BASE_URL="https://api.expvis.smartarch.cz/api/metrics"
AUTH_TOKEN="791964e4630979f0b14dfad25fd99c773afe6102"

POST_PAYLOAD='{
    "metricId": "example01",
    "schema": {
        "field1": "integer",
        "field2": "string",
        "field3": "datetime"
    },
    "data": [
        {
            "id": "101",
            "field1": 42,
            "field2": "example",
            "field3": "2024-06-01T12:27:05.284Z"
        },
        {
            "id": "102",
            "field1": 58,
            "field2": "sample",
            "field3": "2024-06-02T14:27:05.284Z"
        },
        {
            "id": "133",
            "field1": 30,
            "field2": "test",
            "field3": "2024-06-03T10:27:05.284Z"
        },
        {
            "id": "134",
            "field1": 75,
            "field2": "demo",
            "field3": "2024-06-04T18:27:05.284Z"
        },
        {
            "id": "105",
            "field1": 90,
            "field2": "try",
            "field3": "2024-06-05T06:27:05.284Z"
        },
        {
            "id": "106",
            "field1": 20,
            "field2": "success",
            "field3": "2024-06-06T16:27:05.284Z"
        },
        {
            "id": "107",
            "field1": 60,
            "field2": "failure",
            "field3": "2024-06-07T22:27:05.284Z"
        },
        {
            "id": "108",
            "field1": 40,
            "field2": "error",
            "field3": "2024-06-08T08:27:05.284Z"
        },
        {
            "id": "109",
            "field1": 55,
            "field2": "bug",
            "field3": "2024-06-09T12:27:05.284Z"
        },
        {
            "id": "110",
            "field1": 85,
            "field2": "fix",
            "field3": "2024-06-10T14:27:05.284Z"
        },
        {
            "id": "111",
            "field1": 25,
            "field2": "update",
            "field3": "2024-06-11T20:27:05.284Z"
        },
        {
            "id": "112",
            "field1": 70,
            "field2": "patch",
            "field3": "2024-06-12T04:27:05.284Z"
        },
        {
            "id": "113",
            "field1": 45,
            "field2": "release",
            "field3": "2024-06-13T10:27:05.284Z"
        },
        {
            "id": "114",
            "field1": 65,
            "field2": "version",
            "field3": "2024-06-14T18:27:05.284Z"
        },
        {
            "id": "115",
            "field1": 35,
            "field2": "upgrade",
            "field3": "2024-06-15T06:27:05.284Z"
        },
        {
            "id": "116",
            "field1": 80,
            "field2": "downgrade",
            "field3": "2024-06-16T16:27:05.284Z"
        },
        {
            "id": "117",
            "field1": 50,
            "field2": "install",
            "field3": "2024-06-17T22:27:05.284Z"
        },
        {
            "id": "118",
            "field1": 95,
            "field2": "uninstall",
            "field3": "2024-06-18T08:27:05.284Z"
        },
        {
            "id": "119",
            "field1": 22,
            "field2": "setup",
            "field3": "2024-06-19T12:27:05.284Z"
        },
        {
            "id": "120",
            "field1": 68,
            "field2": "configuration",
            "field3": "2024-06-20T14:27:05.284Z"
        }
    ]
}'

echo "Uploading metric with 20 entries..."
curl -X POST $BASE_URL \
     -H "Content-Type: application/json" \
     -H "access-token: $AUTH_TOKEN" \
     -d "$POST_PAYLOAD"

echo -e "\nMetric with 20 entries uploaded."

DATES=("2024-06-02T14:27:05.284Z" "2024-06-05T06:27:05.284Z" "2024-06-08T08:27:05.284Z")
COUNTS=(1 2 10)

for DATE in "${DATES[@]}"
do
    for COUNT in "${COUNTS[@]}"
    do
        echo -e "\nGetting metric data with date: $DATE and count: $COUNT..."
        curl -G "$BASE_URL" \
             --data-urlencode "metricId=example01" \
             --data-urlencode "attribute=field1" \
             --data-urlencode "attribute=field3" \
             --data-urlencode "count=$COUNT" \
             --data-urlencode "startDate=$DATE" \
             --data-urlencode "timeAttribute=field3" \
             -H "access-token: $AUTH_TOKEN"
        echo "\n"
    done
done
