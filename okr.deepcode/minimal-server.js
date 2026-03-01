import express from 'express'
const app = express()
const PORT = 3000

app.get('/', (req, res) => {
    res.send('Minimal server is running on port 3000!')
})

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Minimal Server running at http://0.0.0.0:${PORT}`)
})
