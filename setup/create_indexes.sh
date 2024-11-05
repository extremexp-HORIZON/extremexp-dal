#!/bin/bash

ES_HOST=${ELASTICSEARCH_HOST:-"http://localhost:9200"}

indices=("experiments" "workflows" "metrics")

delete_index_if_exists() {
    local index=$1
    exists="$(curl -s -o /dev/null -w "%{http_code}" -X HEAD "$ES_HOST/$index" -I)"

    if [ "$exists" -eq 200 ]; then
        echo "Deleting index: $index"
        curl -s -X DELETE "$ES_HOST/$index"
        echo "Index $index deleted."
    elif [ "$exists" -eq 404 ]; then
        echo "Index $index does not exist, skipping delete."
    else
        echo "Failed to check index $index. HTTP Status code: $exists"
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

# Function to update an index if it exists, otherwise create it
update_index_if_exists() {
    local index=$1
    local mappings=$2
    exists="$(curl -s -o /dev/null -w "%{http_code}" -X HEAD "$ES_HOST/$index" -I)"

    if [ "$exists" -eq 200 ]; then
        echo "Updating index: $index"
        curl -s -X PUT "$ES_HOST/$index/_mapping" -H 'Content-Type: application/json' -d"$mappings"
        echo "Index $index updated."
    elif [ "$exists" -eq 404 ]; then
        echo "Index $index does not exist, creating it."
        create_index "$index" "$mappings"
    else
        echo "Failed to check index $index. HTTP Status code: $exists"
    fi
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
            "kind": {"type": "text"},
            "name": { "type": "text" },
            "value": { "type": "text" },
            "date": { "type": "date" },
            "records":{
              "type": "nested",
              "properties": {
                "value": { "type": "text" }
              }
            }
        }
    }
}'

for index in "${indices[@]}"; do
    case $index in
        "experiments")
            update_index_if_exists $index "$experiments_mapping"
            ;;
        "workflows")
            update_index_if_exists $index "$workflows_mappings"
            ;;
        "metrics")
            update_index_if_exists $index "$metrics_mappings"
            ;;
    esac
done

echo "Completed updating or creating indices."
