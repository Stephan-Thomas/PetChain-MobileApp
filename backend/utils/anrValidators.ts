import { ValidationResult } from "../models/AnrReport";

/**
 * ANR report validation utilities.
 */
export class AnrReportValidator {
  private static valid(): ValidationResult {
    return { isValid: true, error: null };
  }

  private static invalid(error: string): ValidationResult {
    return { isValid: false, error };
  }

  /**
   * Validate ANR report payload.
   */
  static validatePayload(payload: any): ValidationResult {
    if (!payload || typeof payload !== "object") {
      return this.invalid("Payload must be a valid object.");
    }

    const { platform, type, timestamp, threadName, stackTrace } = payload;

    if (!["android", "ios"].includes(platform)) {
      return this.invalid("Platform must be 'android' or 'ios'.");
    }

    if (!["anr", "hang"].includes(type)) {
      return this.invalid("Type must be 'anr' or 'hang'.");
    }

    if (!timestamp || typeof timestamp !== "string") {
      return this.invalid("Timestamp is required and must be a string.");
    }

    // Basic ISO 8601 validation
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(timestamp)) {
      return this.invalid("Timestamp must be in ISO 8601 format.");
    }

    if (!threadName || typeof threadName !== "string" || threadName.length === 0) {
      return this.invalid("Thread name is required and must be a non-empty string.");
    }

    if (!stackTrace || typeof stackTrace !== "string" || stackTrace.length === 0) {
      return this.invalid("Stack trace is required and must be a non-empty string.");
    }

    // Optional fields validation
    if (payload.appVersion && typeof payload.appVersion !== "string") {
      return this.invalid("App version must be a string if provided.");
    }

    if (payload.osVersion && typeof payload.osVersion !== "string") {
      return this.invalid("OS version must be a string if provided.");
    }

    if (payload.deviceModel && typeof payload.deviceModel !== "string") {
      return this.invalid("Device model must be a string if provided.");
    }

    if (payload.additionalInfo && typeof payload.additionalInfo !== "object") {
      return this.invalid("Additional info must be an object if provided.");
    }

    return this.valid();
  }

  /**
   * Validate report filters.
   */
  static validateFilters(filters: any): ValidationResult {
    if (!filters || typeof filters !== "object") {
      return this.valid(); // Empty filters are valid
    }

    const allowedKeys = [
      "platform", "type", "appVersion", "osVersion", "processed",
      "dateFrom", "dateTo", "limit", "offset"
    ];

    for (const key of Object.keys(filters)) {
      if (!allowedKeys.includes(key)) {
        return this.invalid(`Unknown filter key: ${key}`);
      }
    }

    if (filters.platform && !["android", "ios"].includes(filters.platform)) {
      return this.invalid("Platform filter must be 'android' or 'ios'.");
    }

    if (filters.type && !["anr", "hang"].includes(filters.type)) {
      return this.invalid("Type filter must be 'anr' or 'hang'.");
    }

    if (filters.limit && (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 1000)) {
      return this.invalid("Limit must be an integer between 1 and 1000.");
    }

    if (filters.offset && (!Number.isInteger(filters.offset) || filters.offset < 0)) {
      return this.invalid("Offset must be a non-negative integer.");
    }

    return this.valid();
  }
}</content>
<parameter name="filePath">c:\Users\TECHIE\Documents\GitHub\PetChain-MobileApp\backend\models\AnrReport.ts