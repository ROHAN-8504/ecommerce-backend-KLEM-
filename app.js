const express=require('express')
const cors=require('cors');
const bcrypt=require('bcrypt')
const jwt=require('jsonwebtoken')
const dotenv=require('dotenv')
dotenv.config()
const {rateLimit}=require('express-rate-limit')

const nodemailer=require('nodemailer')
 const helmet=require('helmet');

const app=express();
 app.use(helmet())
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
   let transporter= await nodemailer.createTransport({
      service:'gmail',
      auth:{
        user:process.env.GMAIL_USER,
        pass:process.env.GMAIL_APP_PASSWORD
      }
     })

     let mailOptions={
      from:process.env.GMAIL_USER,
      to:'chrohankumar12345@gmail.com',
      subject:'product update',
      html:`A new product is added in our store`
     }

     transporter.sendMail(mailOptions)

  } catch (error) {
    res.json({
      msg:error.message
    })
  }
})

app.get('/details',(req,res)=>{
   let location=req.query.location;
   let age=req.query.age
   let company=req.query.company
   res.send(`this person is living in ${location}and his age is ${age} and he is working in ${company}`)
})




//api-3-->fetch the data from the dtabase and send these data to client
// ========== FILTERING, SORTING & PAGINATION ==========
app.get('/products',async (req,res)=>{
  try {
    // ===== STEP 1: FILTERING =====
    let filter = {}
    
    // Filter by title (search) - case insensitive
    if(req.query.search){
      filter.title = { $regex: req.query.search, $options: 'i' }
    }
    
    // Filter by exact price
    if(req.query.price){
      filter.price = parseFloat(req.query.price)
    }
    
    // Filter by price range (min and max)
    if(req.query.minPrice || req.query.maxPrice){
      filter.price = {}
      if(req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice)
      if(req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice)
    }
    
    // ===== STEP 2: SORTING =====
    // sortBy = field name (title, price)
    // sortOrder = asc or desc
    let sortBy = req.query.sortBy || 'title'  // default sort by title
    let sortOrder = req.query.sortOrder === 'desc' ? -1 : 1  // default ascending
    let sort = { [sortBy]: sortOrder }
    
    // ===== STEP 3: PAGINATION =====
    let page = parseInt(req.query.page) || 1  // default page 1
    let limit = parseInt(req.query.limit) || 10  // default 10 items per page
    let skip = (page - 1) * limit  // calculate how many to skip
    
    // ===== STEP 4: EXECUTE QUERY =====
    // Run both queries in parallel for better performance
    let [products, totalCount] = await Promise.all([
      productsmodel.find(filter).sort(sort).skip(skip).limit(limit),
      productsmodel.countDocuments(filter)
    ])
    
    // Calculate pagination info
    let totalPages = Math.ceil(totalCount / limit)
    
    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: error.message
    })
  }
})


app.get('/products/:id',async (req,res)=>{
  id=req.params.id
  let singleproduct= await productsmodel.findById(id)
  res.json(singleproduct)
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
   
  let transporter=await nodemailer.createTransport(
  {
    service:'gmail',
    auth:{
      user:process.env.GMAIL_USER,
      pass:process.env.GMAIL_APP_PASSWORD
    }
  }
   )

   let mailOptions={
    from:process.env.GMAIL_USER,
    to:email,
    subject:'ACCOUNT REGISTRATION',
    html:`Hi ${username} your account is created succesfully`
   }

  transporter.sendMail(mailOptions,(error)=>{
    if(error) throw error
   console.log('email sent succesfully')
  }) 




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