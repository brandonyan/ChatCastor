const { CoreClass } = require("@bot-whatsapp/bot");
const fs = require("fs");

class ChatCastorClass extends CoreClass {
  data;
  constructor(_database, _provider, data) {
    super(null, _database, _provider);
    this.data = data;
  }

  saveData = (product, price, means) => {
    const pathData = `./chats/ventas.xlsx`;
    const workbook = new this.data.exceljs.Workbook();
    const today = this.data.moment().format("DD-MM-YY hh:mm");

    if (fs.existsSync(pathData)) {
      workbook.xlsx.readFile(pathData).then(() => {
        const worksheet = workbook.getWorksheet(1);
        worksheet.addRow([today, product, price, means ?? "efectivo"]);
        workbook.xlsx
          .writeFile(pathData)
          .then(() => {
            console.log("Fila agregada correctamente.");
          })
          .catch((error) => {
            console.log("Error al guardar el archivo:", error);
          });
      });
    } else {
      const worksheet = workbook.addWorksheet("Chats");
      worksheet.columns = [
        { header: "Fecha", key: "date" },
        { header: "Producto", key: "product" },
        { header: "Precio", key: "price" },
        { header: "Medio de pago", key: "means" },
      ];
      worksheet.addRow([today, product, price, means ?? "efectivo"]);
      workbook.xlsx
        .writeFile(pathData)
        .then(() => {
          console.log("historial creado");
        })
        .catch((e) => {
          console.log("Algo fallo", e);
        });
    }
  };

  handleMsg = async (ctx) => {
    const { from, body } = ctx;
    
    const regex = /(\D+)\s(\d+\.?\d*)\s?(\D+)?/;
    if (this.data.employs.includes(from) && body?.match(regex)) {
      const [_, product, subPrice, means] = body.match(regex);
      if (means !== "nequi" && means !== "daviplata" && means) {
        
      } else if (product && subPrice) {
        const price = parseFloat(subPrice) * 1000;
        const parseMessagge = {
          answer: `Registro guardado de *${product}*, por valor de *$${price.toLocaleString("es-MX")}*`,
        };

        this.sendFlowSimple([parseMessagge], from);
        this.saveData(product, price, means);

        if (means) {
          const confirmMessagge = {
            answer: `Favor confirmar el pago por *${means.toUpperCase()}* por valor de *$${price.toLocaleString("es-MX")}*`,
          };

          this.sendFlowSimple([confirmMessagge], this.data.nequi);
        }
      }
    }
  };
}

module.exports = ChatCastorClass;
