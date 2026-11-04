import QRCode from "qrcode";

const apkUrl = "https://expo.dev/artifacts/eas/beO4BBjMN7RBQVjDX6aMPyP0XRYe-YbDMa2S29hoVzk.apk";

await QRCode.toFile("./public/medsafe-ai-download-qr.png", apkUrl, {
  width: 1200,
  margin: 3,
  errorCorrectionLevel: "H",
  color: {
    dark: "#241044",
    light: "#FFFFFF"
  }
});

console.log("สร้าง QR Code สำเร็จ!");
