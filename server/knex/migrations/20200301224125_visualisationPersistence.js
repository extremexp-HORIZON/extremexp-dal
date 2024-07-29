
exports.up = (knex, Promise) => (async() => {
  await knex.schema.createTable('systemVisualisation', function(table) {
      table.increments('id').primary();
      table.integer('modelId').unsigned().references('models.id').onDelete('CASCADE');
      table.string('systemName');
      table.text('visualisationData', 'MEDIUMTEXT');      
  })
})();

exports.down = (knex, Promise) => (async() => {
    await knex.schema.dropTable('systemVisualisation');
})();
