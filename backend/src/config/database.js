import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL

const sequelize = new Sequelize(DATABASE_URL, {
	dialect: 'postgres',
	protocol: 'postgres',
	logging: process.env.NODE_ENV === 'development' ? console.log : false,
	dialectOptions: {
		ssl: {
			require: true,
			rejectUnauthorized: false
		}
	},
	define: {
		underscored: true,
		timestamps: true
	}
})

sequelize.authenticate()
	.then(() => console.log('Connected to the PostgreSQL database'))
	.catch((err) => console.error('PostgreSQL connection error:', err))

export default sequelize
