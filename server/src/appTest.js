import express from "express"
import cors from "cors"
import testeRoutes from "../routes/testeRoutes.js"

const testApp = express()

testApp.use(cors())
testApp.use(express.json())

testApp.use("/api/teste", testeRoutes)

export default testApp
