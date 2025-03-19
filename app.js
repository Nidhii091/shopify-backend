const express=require('express');
const app=express();
const {User}=require('./model/User');
const mongoose = require('mongoose');
const cors=require('cors');
const morgan=require('morgan');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const {Product} = require('./model/product');
const {Cart} = require('./model/cart');

// middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'))

// task1 create route for register
app.post('/register',async(req,res)=>{
    try{
        let {name,email,password}=req.body;
        if(!email || !password || !name){
            return res.status(400).jason({message:"some fields are missing"});
        }
        // check if user exists or not
        const isUserAlreadyExist= await User.findOne({email});

        if(isUserAlreadyExist){
            return res.status(400).jason({message:"user already registered"})
        }else{
            //hash the password
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(password,salt);

            // genwrate token
            const token = jwt.sign({email},"supersecret",{expiresIn:'365d'})

            // create user
            await User.create({
                name,
                email,
                password:hashedPassword,
                token,
                role:'user'

            })

            return res.status(201).jason({
                message:"User created succesfully"
            })
        }

    }catch(error){
        console.log("Internal server error",error);
    }
})


// task2 create route for login user
app.post('/login',async(req,res)=>{
    try{
        let {email, password}=req.body;

            if(!email || !password){
                return res.status(400).jason({
                    message:"some fields are empty"
                })

            }

            // check user exist or not
            const user = await User.findOne({email});

            if(!user){
                return res.status(400).json({
                    message:"user is not registered. please register first"
                })
            }

            // compare the entered password
            const isPasswordMatched = bcrypt.compareSync(password, user.password);

            if(!isPasswordMatched){
                return res.status(400).json({
                    message:"Invalid password"
                })
            }
            // user logined successfully
            return res.status(200).json({
                id:user._id,
                name:user.name,
                token:user.token,
                email:user.email,
                role:user.role
            })

    }catch(error){
        console.log("Internal server error",error);
    }
})


// task3 create route to see all product
app.get('/products',async(req,res)=>{
    try{
        const products = await Product.find();
        res.status(200).json({
            message:"product found successfully",
            products:products
        })

    }catch(error){
        console.log(error);
        return res.status(500).json({message:"Internal server error"});
    }
})


// task4 create route to add product
app.post('/add-product',async(req,res)=>{
    try{

        const {name, image, price, description,stock,brand} = req.body;
        const {token} = req.headers;
        const decodedtoken = jwt.verify(token,"supersecret");
        const user = await User.findOne({email:decodedtoken.email});
        const product = await Product.create({
            name,
            description,
            image,
            price, 
            stock,
            brand,
            user:user._id
        })
        return res.status(201).json({
            message:"Product created successfully",
            product:product
        })

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})

// task5 to show a particular product
app.get('/product/:id', async(req,res)=>{
    try{
        const {id} = req.params;
        if(!id){
            res.status(400).json({message:"Product Id not found"});
        }

        const {token} = req.headers;

        const userEmailFromToken = jwt.verify(token,"supersecret");
        if(userEmailFromToken.email){
            const product = await Product.findById(id);

            if(!product){
                res.status(400).json({message:"Product not found"});
            }

            res.status(200).json({message:"success",product});
        }

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
})

// task6 to update a pparticular product
app.patch('/product/edit/:id',async(req,res)=>{   
    try{let{name,description,image,price,brand,stock}=req.body.productData;
    let {id} = req.params;
    let {token} = req.headers;

    const decodedtoken = jwt.verify(token, "supersecret");

    if(decodedtoken.email){
        const updatedProduct = await Product.findByIdAndUpdate(id,{
            name,
            description,
            image,
            price,
            brand,
            stock,
        })
        return res.status(100),json({
            message:"product updated successfully",
            product:updatedProduct
        })
    }

    }catch(error){
        console.log(error);
        return res.status(500).json({message:"Internal server error"});
    }
}) 

// task7 to delete a product
app.delete('/product/delete/:id',async(req,res)=>{
    try{
        const {id} = req.params;

        if(!id){
            return res.status(400).json({message:"product id not found"});
        }

        const deletedProduct = await Product.findByIdAndDelete(id);

        if(!deletedProduct){
            return res.status(404).json({message:'product not found'});

        }
        return res.status(200).json({
            message:"product delted successfully",
            product:deletedProduct
        })

    }catch(error){
        console.log(error);
        return res.status(500).json({message:"Internal server error"});
    }
})

// task8 create a cart module
app.get('/cart',async(req,res)=>{
    const {token} = req.headers;
    const decodedtoken = jwt.verify(token, "supersecret");
    const user = await User.findOne({email:decodedtoken.email}).populate({
        path:'cart',
        populate:{
            path:'products',
            model:'Product'
        }   
    })
    if(!user){
        return res.status(400).json({message:"User not found"})
    }

    return res.status(200).json({
        message:"user found",
        cart:user.cart
    })
})

// task9 create a route to add product in cart
app.post('/cart/add',async(req,res)=>{
    const body = req.body;
    const productArray = body.products;
    let totalPrice = 0;
    try{
        for(const item of productArray){
            const product = await Product.findById(item);

            if(product){
                totalPrice += product.price;
            }
        }

        const {token} = req.headers;
        const decodedtoken = jwt.verify(token, "supersecret");
        const user = await User.findOne({email:decodedtoken.email});

        if(!user){
            res.status(404).json({message:"User not found"});
        }
        let cart;
        if(user.cart){
            cart = await Cart.findById(user.cart).populate("products");
            const existingProductIds = cart.products.map((product)=>{
                product._id.toString()
            })

            productArray.forEach(async(productId)=>{
                if(!existingProductIds.includes(productId)){
                    cart.products.push(productId);

                    const product = await Product.findById(productId);
                    totalPrice += product.price;
                }
            })
            cart.total = totalPrice;
            await cart.save();
        }else{
            cart = new Cart({
              products: productArray,
              total:totalPrice  
            });
            await cart.save();
            user.cart = cart._id;
            await user.save();
        }
        res.status(201).json({message:"cart updated succcesfully",
            cart:cart
        })

    }catch(error){
        console.log(error);
        res.status(500).json({message:"Inernal server Error"})
    }
})



// task10 delete the product from your cart
app.delete("/cart/product/delete", async (req, res) => {
    const { productID } = req.body;
    const { token } = req.headers;
  
    try {
      const decodedToken = jwt.verify(token, "supersecret");
      const user = await User.findOne({ email: decodedToken.email }).populate("cart");
  
      if (!user) {
        return res.status(404).json({ message: "User Not Found" });
      }
  
      const cart = await Cart.findById(user.cart).populate("products");
  
      if (!cart) {
        return res.status(404).json({ message: "Cart Not Found" });
      }
  
      const productIndex = cart.products.findIndex(
        (product) => product._id.toString() === productID
      );
  
      if (productIndex === -1) {
        return res.status(404).json({ message: "Product Not Found in Cart" });
      }
  
      cart.products.splice(productIndex, 1);
      cart.total = cart.products.reduce(
        (total, product) => total + product.price,
        0
      );
  
      await cart.save();
  
      res.status(200).json({
        message: "Product Removed from Cart Successfully",
        cart: cart,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error Removing Product from Cart", error });
    }
  });
      
// moGbbYf9Ar0CX5HB

let MONGODB_URL="mongodb+srv://nidhi77kulkarni:moGbbYf9Ar0CX5HB@cluster0.9pbze.mongodb.net/?retryWrites=true&w=majority"

mongoose.connect( MONGODB_URL)
.then(()=>{
    console.log("DB is connected")
}).catch((err)=>{
    console.log("DB is connected",err)

})


let PORT=8080;
app.listen(PORT,()=>{
    console.log(`server is connected port: ${PORT}`)
})