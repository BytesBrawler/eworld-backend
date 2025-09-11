const express  = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const path = require('path');

// Import bank sync scheduler
const { startBankSyncScheduler, runInitialBankSync } = require("./utils/bankSyncScheduler");

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
// app.use(express.static("public"))
app.use(cookieParser())

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '..', 'web')));

// Start bank sync scheduler
// setTimeout(() => {
//     console.log("🔄 Initializing DMT bank sync scheduler...");
//     startBankSyncScheduler();
    
//     // Run initial sync after 30 seconds to allow server to fully start
//     setTimeout(() => {
//         runInitialBankSync();
//     }, 30000);
// }, 5000);


// app.get("/", (req, res) => {
//     res.sendFile(__dirname + "../web/index.html")
// })
console.log(path.join(__dirname, '..', 'web'));
console.log(path.join(__dirname, '..', 'web/index.html'));


app.get("/", (req, res) => {
   res.sendFile(path.join(__dirname, 'web', 'index.html'));
  });


// app.get("/", (req, res) => {
//     res.send("Hello World")
// });

const errorHandler = require("./middlewares/error.middlewares.js")

const userRouter = require("./routes/users.routes.js")
const authRouter = require("./routes/auth.routes.js")
const walletRouter = require("./routes/wallet.routes.js")
const reportsRouter = require("./routes/reports.routes.js")
const dashboardRouter = require("./routes/dashboard.routes.js")
const notificationRoutes = require('./routes/notification.routes.js');
const adminRoutes= require('./routes/admin.routes.js');
const configurationRouter = require("./routes/configurations.routes.js")
const operatorRoute = require("./routes/operator.routes.js")
const retailerRoutes = require("./routes/retailer.routes.js")
const generalRoutes = require("./routes/general.routes.js")
const resellerRoutes = require("./routes/reseller.routes.js")
const dmtRoutes = require("./routes/dmt.routes.js")
const bbpsRoutes = require("./routes/bbps.routes.js")


//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/wallet", walletRouter)
app.use("/api/v1/reports", reportsRouter)
app.use("/api/v1/dashboard", dashboardRouter)
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin',adminRoutes);
app.use("/api/v1/config", configurationRouter)
app.use("/api/v1/operator", operatorRoute)
app.use("/api/v1/retailers", retailerRoutes)
app.use("/api/v1/general", generalRoutes)
app.use("/api/v1/mtc", resellerRoutes)
app.use("/api/v1/dmt" ,dmtRoutes )
app.use("/api/v1/bbps", bbpsRoutes)

//here i want to define some poitns which diereclty points to my htmo content in htmlcontnetn fodler 
app.get("/apidoc", (req, res) => {
    res.sendFile(__dirname + "/htmlcontent/api_integration_doc.html")
})
app.get("/api_doc", (req, res) => {
    res.sendFile(__dirname + "/htmlcontent/api_doc.html")
})


//add an unnow toue path
app.get("*", (req, res) => {
    res.status(404).json({
        status: 404,
        message: "Route not found"
    })
})


app.use(errorHandler);
module.exports = app ;