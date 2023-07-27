const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
} = require("@bot-whatsapp/bot");
const path = require("node:path");

const QRPortalWeb = require("@bot-whatsapp/portal");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");

const exceljs = require("exceljs");
const moment = require("moment");
const pathData = path.join("ventas.xlsx");

const ChatCastorClass = require("./chatCastor.class");

const employs = [
  "573187481918",
  "573123082083",
  "573112694736",
  "573148537380",
];
const nequi = "573123082083";

const createChatCastor = async ({ provider, database, data }) => {
  return new ChatCastorClass(database, provider, data);
};

const flowPrincipal = addKeyword(
  [
    "Reporte del dia",
    "Informe del dia",
    "Reporte del día",
    "Informe del día",
    "Informe",
    "Reporte",
    "reporte del dia",
    "informe del dia",
    "reporte del día",
    "informe del día",
    "informe",
    "reporte",
    "Reporte completo",
    "Informe completo",
    "Reporte detallado",
    "Informe detallado",
    "Completo",
    "Detallado",
    "reporte completo",
    "informe completo",
    "reporte detallado",
    "informe detallado",
    "completo",
    "detallado",
  ],
  {
    sensitive: true,
  }
).addAction(async (ctx, { endFlow, flowDynamic, provider, sendFlow }) => {
  const today = moment().format("DD-MM-YY");
  const rowsByDate = [];
  const rowsByMeans = {
    efectivo: [],
    nequi: [],
    daviplata: [],
  };
  let totalByDate = 0;
  let totalByMeans = {
    efectivo: 0,
    nequi: 0,
    daviplata: 0,
  };
  let totalProducts = {};

  if (employs.includes(ctx.from)) {
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(pathData);
    const worksheet = workbook.getWorksheet(1);

    worksheet.eachRow((row, rowNumber) => {
      const cellDateValue = row.getCell("A").value;
      const cellMeansValue = row.getCell("D").value;
      const cellPriceValue = row.getCell("C").value;
      const cellProducs = row.getCell("B").value;
      const [day, _] = cellDateValue.split(" ");

      if (day === today) {
        rowsByDate.push(rowNumber);
        totalByDate = totalByDate + cellPriceValue;
        rowsByMeans[cellMeansValue].push(rowNumber);
        totalByMeans[cellMeansValue] =
          totalByMeans[cellMeansValue] + cellPriceValue;
        if (!totalProducts[cellProducs]?.length) {
          totalProducts[cellProducs] = [cellPriceValue];
        } else {
          totalProducts[cellProducs].push(cellPriceValue);
        }
      }
    });

    if (
      rowsByDate.length &&
      (ctx.body.toLowerCase().includes("completo") ||
        ctx.body.toLowerCase().includes("detallado"))
    ) {
      await flowDynamic([
        `Productos vendidos durante el día: *${rowsByDate.length}*
  En efectivo: *${rowsByMeans?.efectivo.length}*
  En nequi: *${rowsByMeans?.nequi.length}*
  En daviplata: *${rowsByMeans?.daviplata.length}*`,
      ]);

      let reportByPrice = Object.entries(totalProducts)
        .map(
          ([producto, precio]) =>
            `${precio.length} ${producto}: *$${precio
              .reduce((acumulador, valorActual) => acumulador + valorActual, 0)
              .toLocaleString("es-MX")}*`
        )
        .join(" \n ");

      await flowDynamic(`Reporte por productos: \n ${reportByPrice}`);
    }

    if (totalByDate) {
      await flowDynamic(
        [
          `Total ventas en el día: *$${totalByDate.toLocaleString(
            "es-MX"
          )}* \n En efectivo: *$${totalByMeans?.efectivo.toLocaleString(
            "es-MX"
          )}* \n En nequi: *$${totalByMeans?.nequi.toLocaleString(
            "es-MX"
          )}* \n En daviplata: *$${totalByMeans?.daviplata.toLocaleString(
            "es-MX"
          )}*`,
        ],
        ctx.from
      );
    }
  }
});

const flowExcel = addKeyword("Excel")
  .addAction(async (ctx, { endFlow }) => {
    if (!employs.includes(ctx.from)) {
      return endFlow();
    }
  })
  .addAnswer("Te envio el Excel", {
    media: pathData,
  });

const flowEdit = addKeyword(["Corregir", "editar"])
  .addAction(async (ctx, { endFlow, flowDynamic }) => {
    if (!employs.includes(ctx.from)) {
      return endFlow();
    }
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(pathData);
    const worksheet = workbook.getWorksheet(1);
    const lastRow = worksheet.lastRow.number;
    let register = "";

    for (let index = 4; index >= 0; index--) {
      let getRowInsert = worksheet.getRow(lastRow - index);
      const Produc = getRowInsert.getCell("B").value;
      const PriceValue = getRowInsert.getCell("C").value;
      const MeansValue = getRowInsert.getCell("D").value;
      register = `${register} \n *${
        5 - index
      }.* ${Produc} $${PriceValue.toLocaleString("es-MX")} ${MeansValue}`;
    }

    await flowDynamic(`Utimos Registros:${register}`);
  })
  .addAnswer(
    "Digite el *numero* del registro que desea corregir seguido de la correccion, con el valor en miles y el medio de pago (ej. *2 bomba de helio 2000 efectivo*)",
    { capture: true },
    async (ctx, { fallBack, flowDynamic }) => {
      let regex = /^([1-5])\s(.+)\s(\d+)\s(nequi|daviplata|efectivo)$/;
      let match = ctx.body.match(regex);
      if (match) {
        const [_, firstNumber, text, numericValue, paymentMethod] = match;

        const workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(pathData);
        const worksheet = workbook.getWorksheet(1);
        const lastRow = worksheet.lastRow.number;
        const selected = lastRow - (5 - firstNumber);

        let getRowInsert = worksheet.getRow(selected);
        getRowInsert.getCell("B").value = text;
        getRowInsert.getCell("C").value = numericValue;
        getRowInsert.getCell("D").value = paymentMethod;

        workbook.xlsx
          .writeFile(pathData)
          .then(() => {
            console.log("Fila editada correctamente.");
          })
          .catch((error) => {
            console.log("Error al editar el archivo:", error);
          });

        flowDynamic(
          `Registro Modificado Correctamente: \n ${text} \n $${numericValue.toLocaleString(
            "es-MX"
          )} \n ${paymentMethod}`
        );
      } else {
        return fallBack();
      }
    }
  );

const flowHelp = addKeyword("Chatbot").addAction(
  async (ctx, { endFlow, flowDynamic, provider, sendFlow }) => {
    if (employs.includes(ctx.from)) {
      await flowDynamic(
        "Bienvenido a ChatBot Gestor: \n  \n *Reporte del día*: Te envía un reporte basico del las ventas del día. \n *Reporte detallado*: Te envía un reporte detallado del las ventas del día. \n *Excel*: Te envía un archivo de excel con todas las ventas."
      );
    }
  }
);

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterProvider = createProvider(BaileysProvider);
  const adapterFlow = createFlow([
    flowPrincipal,
    flowExcel,
    flowHelp,
    flowEdit,
  ]);

  createChatCastor({
    provider: adapterProvider,
    database: adapterDB,
    data: { exceljs, moment, pathData, employs, nequi },
  });

  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();
