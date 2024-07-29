exports.up = (knex, Promise) => (async() => {
    await knex.schema.alterTable('systemVisualisation', function(table) {
        table.string('analysedSystem_hash').nullable();
    });
  })();
  
  exports.down = (knex, Promise) => (async() => {
    await knex.schema.alterTable('systemVisualisation', function(table) {
        table.dropColumn('analysedSystem_hash');
    });
  })();
  