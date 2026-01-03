const express=require('express')
const cors=require('cors');
const bcrypt=require('bcrypt')
const jwt=require('jsonwebtoken')
const dotenv=require('dotenv')
dotenv.config()
const {rateLimit}=require('express-rate-limit')
const app=express();
const port=process.env.PORT
let secretkey=process.env.SECRETKEY
//s1-require he package
const mongoose=require('mongoose')

//s2-establish a connection
//connectin string
async function connection(){
  await mongoose.connect(process.env.MONGODBURL)
}

//s3-create a schema
let productschema=new mongoose.Schema({
  title:{type:String,required:true },
  price:{type:Number,required:true},
  image:{type:String,required:true}, 
})

//s4-create a model
const productsmodel=mongoose.model('products',productschema)




//user model

let userschema=new mongoose.Schema({
  email:{type:String,required:true,unique:true},
  username:{type:String,required:true},
  password:{type:String,required:true},
})

let finalusers=mongoose.model('users',userschema)





const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 10000, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
	// store: ... , // Redis, Memcached, etc. See below.
})
//middleware
app.use(cors())
app.use(limiter)

app.use(express.json())



app.get('/',(req,res)=>{
    res.json({
        msg:"server is active"
    })
})

//design an api where seller send the details and i wil store in database
app.post('/products',async (req,res)=>{
  try {
    const {title,price,image}=req.body
    await  productsmodel.create({title,price,image})
    res.status(201).json({msg:"products are added succesfully"})
  } catch (error) {
    res.json({
      msg:error.message
    })
  }
})

//api-3-->fetch the data from the dtabase and send these data to client
app.get('/products',async (req,res)=>{
  try {
   let products= await productsmodel.find()
   res.status(200).json(products)
  } catch (error) {
    res.json({
      msg:error.message
    })
  }
})

//registration
app.post('/register',async (req,res)=>{
  try {
    const {email,username,password}=req.body
    let users=  await finalusers.findOne({email})
  if(users) return res.json({msg:"user already exists"})
    //hash passwords
   let hashedpassword=await bcrypt.hash(password,10)
   finalusers.create({email,username,password:hashedpassword})
  res.status(201).json({msg:"registration succesful"})
  } catch (error) {
    res.json({msg:error.message})
  }
})


//login
app.post('/login',async (req,res)=>{
  try {
    const {email,password}=req.body;
    let users=await finalusers.findOne({email})
    if(!users) return res.json('invalid credentials') 
   let checkpassword= await bcrypt.compare(password,users.password)
  if(!checkpassword) return res.json({"msg":"email or password is incorrect"})
    let payload={email:email}
 let token=  await jwt.sign(payload,secretkey,{expiresIn:'1hr'})
    res.json({"msg":"login succesfull",token})

  } catch (error) {
    res.json({"msg":error.message})
  }
})












//demo




app.listen(port,async ()=>{
    console.log(`the server is running on ${port}`)
    connection();
    console.log("DB CONNECTED")


    
})  