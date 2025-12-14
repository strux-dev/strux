import { describe, expect, it } from "bun:test"
import {
    parseIoregOutput,
    parseLsusbOutput,
    parseMacSystemProfiler,
    parseWindowsUsbJson,
} from "./index"

describe("USB parsers", () => {
    it("parses lsusb output", () => {
        const sample = `
Bus 001 Device 002: ID 046d:c52b Logitech, Inc. Unifying Receiver
Bus 002 Device 003: ID 05ac:1291 Apple, Inc. Magic Trackpad
`
        const devices = parseLsusbOutput(sample)
        expect(devices).toEqual([
            { vendorId: "046d", productId: "c52b", description: "Logitech, Inc. Unifying Receiver" },
            { vendorId: "05ac", productId: "1291", description: "Apple, Inc. Magic Trackpad" },
        ])
    })

    it("parses mac system_profiler json", () => {
        const sample = JSON.stringify({
            SPUSBDataType: [
                {
                    _name: "USB 3.0 Bus",
                    items: [
                        {
                            _name: "Magic Trackpad",
                            vendor_id: "0x05ac",
                            product_id: "0x1291",
                        },
                    ],
                },
            ],
        })

        const devices = parseMacSystemProfiler(sample)
        expect(devices).toEqual([
            { vendorId: "05ac", productId: "1291", description: "Magic Trackpad" },
        ])
    })

    it("parses mac ioreg output", () => {
        const sample = `
    +-o Magic Trackpad@14200000  <class AppleUSBDevice, id 0x100010d7b, registered, matched, active, busy 0 (7 ms), retain 16>
      {
        "idProduct" = 0x1291
        "USB Product Name" = "Magic Trackpad"
        "idVendor" = 0x05ac
      }
`
        const devices = parseIoregOutput(sample)
        expect(devices).toEqual([
            { vendorId: "05ac", productId: "1291", description: "Magic Trackpad" },
        ])
    })

    it("parses windows usb json", () => {
        const sample = JSON.stringify([
            {
                InstanceId: "USB\\VID_046D&PID_C52B\\123456",
                FriendlyName: "Logitech Unifying Receiver",
            },
            {
                InstanceId: "USB\\VID_05AC&PID_1291\\ABCDEFG",
                FriendlyName: "Magic Trackpad",
            },
        ])

        const devices = parseWindowsUsbJson(sample)
        expect(devices).toEqual([
            { vendorId: "046d", productId: "c52b", description: "Logitech Unifying Receiver" },
            { vendorId: "05ac", productId: "1291", description: "Magic Trackpad" },
        ])
    })
})
