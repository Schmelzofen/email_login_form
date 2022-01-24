const express = require('express')
const app = express()
var cookieParser = require('cookie-parser')
const nodemailer = require('nodemailer')
const { v4: uuidv4 } = require('uuid')
var crypto = require('crypto')
require('dotenv').config()
const formidable = require("formidable")
const mongoose = require('mongoose')
mongoose.Promise = require("bluebird");
// SOCKET.IO
const server = require('http').createServer(app)
const { Server } = require("socket.io")
const { createAdapter } = require("@socket.io/mongo-adapter");
const io = new Server(server)

// MONGODB CONNECTION
const url = "mongodb://localhost:27017,127.0.0.1:27018/"
const connect = mongoose.connect(url, { useNewUrlParser: true })
const db = mongoose.connection
db.once("open", _ => {
    console.log("Database connected: ", url)
})
db.on("error", err => {
    console.error("Connection error: ", err)
})

var Message = mongoose.model("Message", { username: String, message: String, date: Date })
var ChatMessage = mongoose.model("ChatMessage", { username: String, message: String, date: Date })
var messages = []
ChatMessage.watch()
    .on('change', data => {
        messages = data
    })
// --------------------------------------------

let authTokens = {}
var userDatabase = [
    {
        name: "Ron Howard",
        username: "BlackDynamite",
        email: "test@web.de",
        password: "WZRHGrsBESr8wYFZ9sx0tPURuZgG2lmzyvWpwXPKz8U=",
        confirmationStatus: true,
        id: 1,
        profile: {}
    },
    {
        name: "Riley O' Connor",
        username: "SlimJimFanatic",
        email: "test1@web.de",
        password: "A6xnQhbz4Vx2HuGl4lXwZ5U2I8iziLRFnhP5eNfIRvQ=",
        confirmationStatus: false,
        confirmationCode: 123456,
        id: 2,
        profile: {}
    },
    {
        name: "Brigitte Bauer",
        username: "Stahlgewitter",
        email: "test3@web.de",
        password: "WZRHGrsBESr8wYFZ9sx0tPURuZgG2lmzyvWpwXPKz8U=",
        confirmationStatus: true,
        id: 3,
        profile: {}
    },
    {
        name: "Bobo Pleb",
        username: "Kuschelbaer99",
        email: "test4@web.de",
        password: "WZRHGrsBESr8wYFZ9sx0tPURuZgG2lmzyvWpwXPKz8U=",
        confirmationStatus: true,
        id: 4,
        profile: {}
    },
]


const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.CLIENT_EMAIL,
        pass: process.env.CLIENT_PASSWORD,
    },
    logger: true
})

// Authentification, PasswordHash, ConfirmationCode
const generateAuthToken = () => {
    return crypto.randomBytes(30).toString('hex');
}
const confirmationCode = () => {
    return Math.ceil((Math.random() * 1000000))
}
const getHashedPassword = (password) => {
    const sha256 = crypto.createHash("sha256")
    const hash = sha256.update(password).digest("base64")
    return hash
}
//-------------------------------------------------

/* MIDDLEWARE FOR AUTHENTICATION */
const requireAuth = (req, res, next) => {
    if (req.user) {
        next()
    } else {
        res.render("pages/login", {
            user: req.user,
        })
    }
};

app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.use((req, res, next) => {
    // Get auth token from the cookies
    const authToken = req.cookies['AuthToken']
    // Inject the user to the request
    req.user = authTokens[authToken]
    next()
})

app.get("/", (req, res) => {
    console.log(messages)
    // console.log(req.cookies['AuthToken'])
    // console.log("ReqCookies: ", req.cookies)
    // console.log("AuthTokens: ", authTokens)
    // --------------
    res.render("pages/index", {
        user: req.user,
    })
})
// LOGIN
app.get("/login", (req, res) => {
    res.render("pages/login", {
        user: req.user
    })
})
// LOGOUT
app.get("/logout", (req, res) => {
    authTokens = {}
    res.clearCookie("AuthToken")
    res.clearCookie(undefined)
    res.redirect("/")
})
// NEW USER
app.post("/new", (req, res) => {
    const form = formidable({ multiples: true })
    form.parse(req, (err, fields) => {
        if (err) {
            next(err)
            return
        }
        const user = {
            name: fields.name,
            username: fields.username,
            email: fields.email,
            password: getHashedPassword(fields.password),
            confirmationCode: confirmationCode(),
            confirmationStatus: false,
            id: uuidv4().slice(0, 8),
            profile: {}
        }
        const foundUser = userDatabase.find(u => u.username === user.username || u.email === user.email)
        if (foundUser) {
            res.render("pages/duplicate")
        } else {
            userDatabase.push(user)
            transporter.sendMail({
                from: `"Flakebook Admin" <${process.env.CLIENT_EMAIL}>`,
                to: `${user.email}`,
                subject: "Your confirmation code",
                text: `Here's your confirmation code: ${user.confirmationCode} \n
                        And for security purposes your ID: ${user.id}\n\n
                        Flakebook Team`,
                html: `<h1>Here's your confirmation code: </h1><br> <p>${user.confirmationCode}</p><br>
                        <p>And for security purposes your ID: ${user.id}</p> <br>
                        <br><h1>Flakebook Team</h1>`,
            })
            res.render("pages/activate", {
                user: req.user
            })
        }
    });
})
// ----------------------------------------------
// VERIFICATION
app.post("/verification", (req, res) => {
    const form = formidable({ multiples: true })
    form.parse(req, (err, fields) => {
        if (err) {
            next(err)
            return
        }
        const verified = userDatabase.find(u => u.id == fields.id && u.confirmationCode == fields.confirmationCode)
        if (verified) {
            userDatabase.find(u => {
                if (u.id == fields.id) {
                    u.confirmationStatus = true
                }
            })
            res.render("pages/verified", {
                user: req.user,
            })
        } else {
            res.send("try again")
        }
    })
})
// -------------------------------------------
// RESEND VERIFICATION MAIL
app.get("/resendverification/:id", requireAuth, (req, res) => {
    const id = req.params.id
    const user = userDatabase.find(u => u.id == id)
    if (user) {
        transporter.sendMail({
            from: `"Flakebook Admin" <${process.env.CLIENT_EMAIL}>`,
            to: `${user.email}`,
            subject: "Your confirmation code",
            text: `Here's your confirmation code: ${user.confirmationCode} \n
                    And for security purposes your ID: ${user.id}\n\n
                    Flakebook Team`,
            html: `<h1>Here's your confirmation code: </h1><br> <p>${user.confirmationCode}</p><br>
                    <p>And for security purposes your ID: ${user.id}</p> <br>
                    <br><h1>Flakebook Team</h1>`,
        })
        res.render("pages/activate", {
            user,
        })
    }
})
// GET SPECIFIC USER
app.post("/user", requireAuth, (req, res) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields) => {
        if (err) {
            next(err);
            return;
        }
        const foundUser = userDatabase.find(u => u.id === Number(fields.id))
    })
})
// --------------------------------------
// EDIT USER PROFILE
app.get("/profile/:id", requireAuth, (req, res) => {
    const id = req.params.id
    const user = userDatabase.find(u => u.id == id)
    res.render("pages/profile", {
        user
    })
})
/* -------------------------------------- */
// REGISTRATION FORM ROUTE
app.get("/registration", (req, res) => {
    res.render("pages/registration", {
        user: req.user
    })
})

app.post("/login", (req, res) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields) => {
        if (err) {
            console.log(err)
            next(err);
            return;
        }
        const hashedPassword = getHashedPassword(fields.password)
        const user = userDatabase.find(u => u.email === fields.email && u.password === hashedPassword)

        switch (user) {
            case undefined:
                res.send("wrong pw or email")
                break;
        }
        if (!user.confirmationStatus) {
            res.render("pages/activate", {
                user
            })
        } else if (user.confirmationStatus) {
            const authToken = generateAuthToken()
            authTokens[authToken] = user
            res.cookie("AuthToken", authToken)
            res.redirect("/")
        }
    })
})
// MESSAGESYSTEM OR SOMETHING LIKE THAT
app.get("/messages", requireAuth, (req, res) => {
    res.render("pages/messages", {
        user: req.user,
    })
})
app.post("/message", requireAuth, (req, res) => {
    const form = formidable({ multiples: true })
    form.parse(req, (err, fields) => {
        if (err) {
            console.log(err)
            next(err)
            return
        }
        const msg = {
            username: req.user.username,
            message: fields.message,
            date: new Date(),
        }
        var message = new Message(msg)
        message.save((err) => {
            if (err)
                render("pages/404")
            res.render("pages/chat", {
                user: req.user,
            })
        })
    })
})
app.get("/chat", requireAuth, (req, res) => {
    ChatMessage.find({}, function (err, docs) {
        messages = docs
        res.render("pages/chat", {
            user: req.user,
            messages,
        })
    })
})
app.post("/chat", requireAuth, (req, res) => {
    const form = formidable({ multiples: true })
    form.parse(req, (err, fields) => {
        if (err) {
            console.log(err)
            next(err)
            return
        }
        const msg = {
            username: req.user.username,
            message: fields.message,
            date: new Date(),
        }
        var message = new ChatMessage(msg)
        message.save((err) => {
            if (err) {
                render("pages/404")
            } else {
                ChatMessage.find({}, function (err, docs) {
                    messages = docs
                    res.render("pages/chat", {
                        user: req.user,
                        messages,
                    })
                })
            }
        })
    })
})

io.on('connection', (socket) => {
    console.log("User connected")
    socket.on("disconnect", () => {
        console.log("User has disconnected")
    })
    socket.on('UpdateOnDatabase', function (msg) {
        console.log("Message has been sent")
        ChatMessage.find({}, function (err, docs) {
            messages = docs
        })
        socket.broadcast.emit('RefreshPage')
    });
})

const PORT = process.env.PORT || 3000
server.listen(PORT, function () {
    console.log("Listening on port " + PORT);
})