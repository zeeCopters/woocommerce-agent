import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import dotenv from "dotenv";

dotenv.config();

const baseUrl = (process.env.WC_URL || "").replace(/\/+$/, "");
if (!baseUrl) throw new Error("WC_URL not set in .env");

const jar = new CookieJar();

const client = wrapper(
  axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    jar,
    auth: {
      username: process.env.WC_KEY,
      password: process.env.WC_SECRET,
    },
  })
);

export { client, jar };

// curl -k -u ck_a37c1266ccebabb4d8d57c062771b7dc337478e4:cs_3e732191b1b9cfbc78ed815ae136ad8c82556870 https://wordpress.local/wp-json/wc/v3/products

// curl -v -u ck_a37c1266ccebabb4d8d57c062771b7dc337478e4:cs_3e732191b1b9cfbc78ed815ae136ad8c82556870 https://wordpress.local/wp-json/wc/v3/products --insecure
