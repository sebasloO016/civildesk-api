const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST     || 'localhost',
    port:    process.env.DB_PORT     || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true'
        ? { require: true, rejectUnauthorized: false }
        : false,
    },
    pool: {
      max:     10,
      min:     2,
      acquire: 30000,
      idle:    10000,
    },
    define: {
      underscored:   true,    // snake_case en DB
      timestamps:    true,
      createdAt:     'created_at',
      updatedAt:     'updated_at',
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅  PostgreSQL conectado correctamente');
  } catch (err) {
    console.error('❌  Error conectando a PostgreSQL:', err.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
