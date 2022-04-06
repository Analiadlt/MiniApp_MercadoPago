const { User, Order, Product } = require("../db");
const server = require('express').Router();

// SDK de Mercado Pago
const mercadopago = require ('mercadopago');

const { ACCESS_TOKEN , REACT_APP_API , REACT_APP_CLIENT } = process.env;

//Agrega credenciales
mercadopago.configure({
  access_token: ACCESS_TOKEN
});


//Ruta que genera la URL de MercadoPago
server.get("/", async (req, res, next) => {

  const {id_orden}= req.query;

  try {
    const order = await Order.findOne({
      where: {
        id: id_order
      }
    })

    const carrito = await Product.findAll({
      where: {
        orderId: id_order
      }
    })

    const items_ml = carrito?.map(i => ({
      title: i.name,
      unit_price: Math.ceil(i.sellPrice),
      quantity: 1,
    }))

    // Crea un objeto de preferencia
    let preference = {
      items: items_ml,
      external_reference: `${id_order}`,
      payment_methods: {
        excluded_payment_types: [
          {
            id: "atm", 
            id: "ticket"
          }
        ],
        installments: 3  //Cantidad máximo de cuotas
      },
      back_urls: {
        success: REACT_APP_API + '/mercadopago/pagos',
        failure: REACT_APP_API + '/mercadopago/pagos',
        pending: REACT_APP_API + '/mercadopago/pagos',
      },
    };

    const response = await mercadopago.preferences.create(preference)
    //console.log("REPONDIO", response)
    res.json({ id: response.body.id })

  } catch (error) {
    res.send("No se genero correctamente ID-MP")
  }
}) 


//Ruta que recibe la información del pago
server.get("/pagos", async (req, res)=>{
  console.info("EN LA RUTA PAGOS ", req)
  const {
    payment_id,
    payment_type,
    status,
    external_reference,
    merchant_order_id
  } = req.query;

  //Aquí edito el status de mi orden
  //proceso los datos del pago 
  //redirijo de nuevo a react con mensaje de exito, falla o pendiente
  try {
    const order = await Order.findByPk(external_reference)
    order.payment_id = payment_id
    order.pay_method = payment_type
    order.payment_status = status
    order.merchant_order_id = merchant_order_id
    order.status = "completed"

    //console.log("ORDER", order)

    try {
      console.info('Salvando order')
      await order.save()

      if (order.payment_status === "approved") {
        const user = await User.findByPk(order.userId)
        //console.log("USER", user)
        const products = await Product.findAll({ where: { orderId: order.id } })
        //console.log("CARDS", cards)
        for (const product of products) {
          //console.log("BUCLE", card)
          user.addProducts(product)
        }
        return res.redirect(`${REACT_APP_CLIENT}/Detail`)
      
      } else {
        res.json({ error: "No se pudo completar la transaccion" })
      }

    }
    catch (error) {
      console.error('error al salvar', error)
      return res.redirect(`${REACT_APP_CLIENT}/?error=${err}&where=al+salvar`)
    }

  } catch (error) {
    console.error('error al buscar', error)
    return res.redirect(`${REACT_APP_CLIENT}/?error=${err}&where=al+buscar`)
  }

})


//Busco información de una orden de pago
server.get("/pagos/:id", (req, res)=>{
  const mp = new mercadopago(ACCESS_TOKEN)
  const id = req.params.id
  console.info("Buscando el id", id)
  mp.get(`/v1/payments/search`, {'status': 'pending'}) //{"external_reference":id})
  .then(resultado  => {
    console.info('resultado', resultado)
    res.json({"resultado": resultado})
  })
  .catch(err => {
    console.error('No se consulto:', err)
    res.json({
      error: err
    })
  })
})

module.exports = server;