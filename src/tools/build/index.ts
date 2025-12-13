/***
 *
 *
 *  Build Tool
 *
 */

import { validateConfigWithUrlCheck, type Config } from "../../types/config"
import { runWithSpinner } from "../../utils/colors"

export const build = async () => {


    // Get the current working directory
    const cwd = process.cwd()

    // Config File Read
    const configFile = Bun.file(`${cwd}/strux.json`)
    const rawConfigData = await configFile.json() as Config

    // Validate the Config and set defaults
    const config = validateConfigWithUrlCheck(rawConfigData)


}