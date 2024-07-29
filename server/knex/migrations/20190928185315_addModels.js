
exports.up = async function(knex) {
    // This is a backport fix for migration 202004110000 from ivis-core, which can be non-deterministically applied either before or after this migration
    // That migration changes the data type of namespace.id column from unsigned to signed integer.
    const isNamespaceSigned = (await knex('knex_migrations').where({name: '20200411000000_change_namespace_id_type.js'}).count())[0]['count(*)'] > 0;

    await knex.schema.createTable('models', function(table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('code', 'MEDIUMTEXT').notNullable().defaultTo(''); // sets a 16MB limit on separate files
        if (isNamespaceSigned)
            table.integer('namespace').notNullable().references('namespaces.id');
        else
            table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    await knex.schema.createTable('permissions_model', function(table) {
        table.integer('entity').unsigned().notNullable().references('models.id').onDelete('CASCADE');
        table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('operation', 128).notNullable();
        table.primary(['entity', 'user', 'operation']);
    });

    await knex.schema.createTable('shares_model', function(table) {
        table.integer('entity').unsigned().notNullable().references('models.id').onDelete('CASCADE');
        table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('role', 128).notNullable();
        table.boolean('auto').defaultTo(false);
        table.primary(['entity', 'user']);
    })
};

exports.down = (knex) => (async() => {
    await knex.schema.dropTable('models');
    await knex.schema.dropTable('permissions_model');
    await knex.schema.dropTable('shares_model');
})();
