import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import fs from 'fs'
import bcrypt from 'bcryptjs'

import User from './models/User.js'
import config from './config.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

// Fix __dirname (ESM)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ======================
// MIDDLEWARE
// ======================
app.use(express.json())
app.use(cors())

// ======================
// LOAD ROUTES
// ======================
async function loadRoutes() {
  const routeConfigs = [
    { path: './routes/auth.js', mount: '/api/auth' },
    { path: './routes/users.js', mount: '/api/users' },
    { path: './routes/okrs.js', mount: '/api/okrs' },
    { path: './routes/my-okrs.js', mount: '/api/my-okrs' },
    { path: './routes/tasks.js', mount: '/api/tasks' },
    { path: './routes/reports.js', mount: '/api/reports' },
    { path: './routes/departments.js', mount: '/api/departments' },
    { path: './routes/kpis.js', mount: '/api/kpis' },
    { path: './routes/analytics.js', mount: '/api/analytics' },
    { path: './routes/workgroups.js', mount: '/api/workgroups' },
    { path: './routes/cycles.js', mount: '/api/cycles' },
    { path: './routes/automation.js', mount: '/api/automation' },
    { path: './routes/attendance.js', mount: '/api/attendance' },
    { path: './routes/schedules.js', mount: '/api/schedules' },
    { path: './routes/projects.js', mount: '/api/projects' },
    { path: './routes/features.js', mount: '/api/features' },
    { path: './routes/sprints.js', mount: '/api/sprints' },
    { path: './routes/tasksAgile.js', mount: '/api/tasks-agile' },
    { path: './routes/notesAgile.js', mount: '/api/notes-agile' }
  ]

  for (const route of routeConfigs) {
    try {
      const mod = await import(route.path)
      if (mod.default) {
        app.use(route.mount, mod.default)
        console.log(`✅ Mounted ${route.mount}`)
      }
    } catch (err) {
      console.error(`❌ Failed ${route.path}:`, err.message)
    }
  }
}

// ======================
// DEFAULT ADMIN
// ======================
async function ensureDefaultAdmin() {
  try {
    const { email, password, name } = config.defaultAdmin
    const existing = await User.findOne({ email })

    if (existing) {
      if (existing.role !== 'QUẢN TRỊ VIÊN') {
        existing.role = 'QUẢN TRỊ VIÊN'
        await existing.save()
      }
      console.log('✅ Default admin ready')
      return
    }

    const hash = await bcrypt.hash(password, 10)

    await User.create({
      name,
      email,
      password: hash,
      role: 'QUẢN TRỊ VIÊN',
      department: 'Ban Giám Đốc',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
    })

    console.log('✅ Default admin created')
  } catch (err) {
    console.error('❌ Admin error:', err.message)
  }
}

// ======================
// DATABASE
// ======================
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ MongoDB Connected')
    await ensureDefaultAdmin()
  } catch (err) {
    console.error('❌ MongoDB Error:', err.message)
    process.exit(1)
  }
}

// ======================
// SERVE FRONTEND
// ======================
function serveFrontend() {
  const clientPath = path.join(__dirname, 'client', 'dist')

  if (!fs.existsSync(clientPath)) {
    console.error('❌ client/dist not found. Run: npm run build inside client folder')
    return
  }

  console.log('📦 Serving frontend from:', clientPath)

  app.use(express.static(clientPath))

  // React SPA fallback
  app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(404).json({ message: 'API not found' })
    }

    res.sendFile(path.join(clientPath, 'index.html'))
  })
}

// ======================
// ERROR HANDLER
// ======================
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err)
  res.status(500).json({ message: 'Internal Server Error' })
})

// ======================
// START SERVER
// ======================
async function start() {
  await connectDB()
  await loadRoutes()
  serveFrontend()

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Running on http://0.0.0.0:${PORT}`)
  })
}

start()