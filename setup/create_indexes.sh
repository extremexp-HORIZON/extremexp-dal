#!/bin/bash

ES_HOST="http://localhost:9200"

indices=("experiments" "workflows" "tasks" "metrics" "parameters"
"input_datasets" "output_datasets" "signal_sets")

delete_index_if_exists() {
    local index=$1
    exists=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$ES_HOST/$index/_search?q=*")
    if [ "$exists" -eq 200 ]; then
        echo "Deleting index: $index"
        curl -s -X DELETE "$ES_HOST/$index"
        echo ""
    else
        echo "Index $index does not exist, skipping delete."
        echo ""
    fi
}


# Function to create an index with the correct mappings
create_index() {
    local index=$1
    local mappings=$2
    echo "Creating index: $index"
    curl -s -X PUT "$ES_HOST/$index" -H 'Content-Type: application/json' -d"$mappings"
    echo ""
}

experiments_mapping='
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text" },
      "status": { "type": "text" },
      "start": { "type": "date" },
      "end": { "type": "date" },
      "metadata": {
        "type": "nested",
        "properties": {
          "key": { "type": "keyword" },
          "value": { "type": "text" }
        }
      },
      "model": { "type": "text" },
      "comment": { "type": "text" },
      "workflow_ids": {
        "type": "keyword"
      }
    }
  }
}'


workflows_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "id": { "type": "keyword" },
            "experimentId" : { "type": "keyword"},
            "name": { "type": "text" },
            "status": { "type": "text" },
            "start": { "type": "date" },
            "end": { "type": "date" },
            "metadata": {
                "type": "nested",
                "properties": {
                    "key": { "type": "keyword" },
                    "value": { "type": "text" }
                }
            },
            "comment": { "type": "text" },
            "parameter_ids": { "type": "keyword"  },
            "input_datasets_ids": { "type": "keyword" },
            "metric_ids": { "type": "keyword" },
            "output_ids": { "type": "keyword" },
            "tasks_id": {"type": "keyword" }
        }
    }
}'

tasks_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "experimentId" : { "type": "keyword"},
            "id": { "type": "keyword" },
            "name": { "type": "text" },
            "start": { "type": "date" },
            "end": { "type": "date" },
            "metadata": {
                "type": "nested",
                "properties": {
                    "key": { "type": "keyword" },
                    "value": { "type": "text" }
                }
            },
            "comment": { "type": "text" },
            "workflow": { "type": "keyword" },
            "source_code": { "type": "text" },
            "parameter_ids":  { "type": "keyword" },
            "input_dataset_ids": { "type": "keyword" },
            "metric_ids": { "type": "keyword" },
            "output_dataset_ids": { "type": "keyword" }
        }
    }
}'

metrics_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "experimentId" : { "type": "keyword"},
            "parent_type": { "type": "text" },
            "parent_id": { "type": "keyword" },
            "type": { "type": "text"},
            "semantic_type": { "type" : "text" },
            "name": { "type": "text" },
            "value": { "type": "text" },
            "date": { "type": "date" },
            "records":{
              "type": "nested",
              "properties": {
                "value" { "type": "text" }
              }
            }
        }
    }
}'

parameters_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "experimentId" : { "type": "keyword"},
            "name": { "type": "text" },
            "type": { "type": "keyword" },
            "value": { "type": "text" },
            "usedByTasks": { "type": "text"},
            "parent_type": { "type": "text" },
            "parent_id": { "type": "keyword" },
        }
    }
}'

input_datasets_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "experimentId" : { "type": "keyword"},
            "parent_type": { "type": "text" },
            "parent_id": { "type": "keyword" },
            "title": { "type": "text" },
            "uri": { "type": "text" },
            "date": { "type": "date" },
            "checksum": { "type": "text" }
        }
    }
}'

output_datasets_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "experimentId" : { "type": "keyword"},
            "parent_type": { "type": "text" },
            "parent_id": { "type": "keyword" },
            "title": { "type": "text" },
            "uri": { "type": "text" },
            "date": { "type": "date" },
            "checksum": { "type": "text" },
            "description": { "type": "text" }
        }
    }
}'

for index in "${indices[@]}"; do
    delete_index_if_exists $index
    case $index in
        "experiments")
            create_index $index "$experiments_mapping"
            ;;
        "workflows")
            create_index $index "$workflows_mappings"
            ;;
        "tasks")
            create_index $index "$tasks_mappings"
            ;;
        "metrics")
            create_index $index "$metrics_mappings"
            ;;
        "parameters")
            create_index $index "$parameters_mappings"
            ;;
        "input_datasets")
            create_index $index "$input_datasets_mappings"
            ;;
        "output_datasets")
            create_index $index "$output_datasets_mappings"
            ;;
    esac
done

echo "Completed recreating indices."
