'use strict';

const express = require('express');
const cors = require('cors');

const auth = require('./auth'); // Updated path
const user = require('./user'); // Updated path
const product = require('./product'); // Updated path
const order = require('./order'); // Updated path
const payment = require('./payment'); // Updated path

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', auth);
app.use('/user', user);
app.use('/product', product);
app.use('/order', order);
app.use('/payment', payment);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
