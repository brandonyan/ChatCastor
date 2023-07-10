const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
} = require("@bot-whatsapp/bot");

const QRPortalWeb = require("@bot-whatsapp/portal");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");

const exceljs = require("exceljs");
const moment = require("moment");
const pathData = `./chats/ventas.xlsx`;

const ChatCastorClass = require("./chatCastor.class");

const employs = ["573187481918", "573123082083", "573112694736"];
const nequi = "573112694736";

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

const flowExcel = addKeyword("Excel").addAnswer("Te envio el Excel", {
  media: "./chats/ventas.xlsx",
});

const flowHelp = addKeyword("Chatbot").addAction(
  async (ctx, { endFlow, flowDynamic, provider, sendFlow }) => {
    if (employs.includes(ctx.from)) {
      await flowDynamic(
        "Bienvenido a ChatBot Gestor: \n *Reporte del día*: Te envía un reporte basico del las ventas del día. \n *Reporte detallado*: Te envía un reporte detallado del las ventas del día. \n *Excel*: Te envía un archivo de excel con todas las ventas."
      );
    }
  }
);

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterProvider = createProvider(BaileysProvider);
  const adapterFlow = createFlow([flowPrincipal, flowExcel, flowHelp]);

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
