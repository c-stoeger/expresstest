const express = require('express')

const app = express()

app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.render('pages/index')
})

app.get('/about', (req, res) => {
    res.render('pages/about')
})

app.get('/vnc', (req, res) => {
    res.render('pages/vnc')
})


app.listen(3000, () => {
    console.log('http://localhost:3000')
})