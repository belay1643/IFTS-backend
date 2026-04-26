import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'viewer' },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false }
  // Add other fields as needed
}, {
  tableName: 'users',
  timestamps: true
});

export default User;
