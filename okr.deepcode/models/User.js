import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['QUẢN TRỊ VIÊN', 'TRƯỞNG PHÒNG', 'NHÂN VIÊN', 'TRƯỞNG NHÓM'], default: 'NHÂN VIÊN' },
  department: { type: String },
  avatar: { type: String },
  supervisorId: { type: String }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
