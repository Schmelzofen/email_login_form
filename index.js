const express = require('express');
const res = require('express/lib/response');
const app = express();
const nodemailer = require('nodemailer')
const { v4: uuidv4 } = require('uuid');
require('dotenv').config()

const userDatabase = [{
    email: "test@web.de",
    password: "12345",
    confirmationStatus: true,
}]

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.CLIENT_EMAIL,
        pass: process.env.CLIENT_PASSWORD,
    },
    logger: true
});


const confirmationCode = () => {
    return Math.ceil((Math.random() * 1000000))
}

function logger(req, _, next) {
    console.log(req.method, req.url)
    next()
}

app.set('view engine', 'ejs')
app.use(logger)
app.use(express.static(__dirname + '/public'))
app.use(express.urlencoded())

app.get("/", (req, res) => {
    const authenticated = false
    res.render("pages/index", {
        authenticated,
    })
})

app.post("/new", (req, res) => {
    const newUser = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        password: req.body.password,
        confirmationCode: confirmationCode(),
        confirmationStatus: false,
        id: uuidv4(),
    }
    userDatabase.push(newUser)
    const filterEmail = userDatabase.filter(u => u.email === req.body.email)
    if (filterEmail.length > 1) {
        userDatabase.pop()
        return res.render("pages/duplicate")
    } else {
        transporter.sendMail({
            from: '"Peter Parker" <spidermanycutie123@gmail.com>', // sender address
            to: `${newUser.email}`, // list of receivers
            subject: "Please confirm your registration!", // Subject line
            text: `Thanks, for your registration!\nHere's your code: ${newUser.confirmationCode}`, // plain text body
            html: `<h1>Thanks, for your registration!</h1> <p>Here's your code: ${newUser.confirmationCode}</p>`, // html body
        });
        return res.render("pages/register")
    }
})

app.post("/login", (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password,
    }
    const filterUser = userDatabase.filter(u => u.email === req.body.email)
    if (filterUser[0].password == user.password) {
        if (filterUser[0].confirmationStatus === true) {
            const authenticated = true
            res.render("pages/index", {
                authenticated
            })
        } else {
            res.send("Please confirm your account!")
        }
    } else {
        res.send("Password incorrect")
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, function () {
    console.log("Listening on port " + PORT);
})