import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'

dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL

const sequelize = new Sequelize(DATABASE_URL, {
	dialect: 'postgres',
	protocol: 'postgres',
	logging: process.env.NODE_ENV === 'development' ? console.log : false,
	define: {
		underscored: true,
		timestamps: true
	}
})

export default sequelize
