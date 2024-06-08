export interface Query {
    __typename?: "Query";
    logEntryById?: LogEntry | null;
    logEntryListConnection?: LogEntryListConnection | null;
    logEntryStats?: LogEntryStats;
    logEventsOTP?: string;
    logErrorById?: LogError | null;
    logErrorFrameById?: LogErrorFrame | null;
    logFilterById?: LogFilter | null;
    logFilterList?: LogFilter[];
    logZipRequestById?: LogZipRequest | null;
    logZipRequestList?: LogZipRequest[];
    auditLogEntryListConnection?: AuditLogEntryListConnection | null;
    serverLoad?: ServerLoadResultObject[];
    sqlQuery?: SQLQueryResult;
    emailsAreSupported?: boolean;
    userById?: User | null;
    userList?: User[];
    userRoleList?: UserRole[];
    userAuthenticate?: Auth;
    usageCountById?: UsageCount | null;
    usageCountListConnection?: UsageCountListConnection | null;
    usageLocationById?: UsageLocation | null;
    usageLocationList?: UsageLocation[];
}
export interface Mutation {
    __typename?: "Mutation";
    logFilterSave?: LogFilter;
    logFilterListRemoveByIds?: Void | null;
    logZipRequestSave?: LogZipRequest;
    logZipRequestListRemoveByIds?: Void | null;
    userCreate?: Auth | null;
    userUpdate?: Void | null;
    userUpdatePassword?: Void | null;
    userRequestPasswordReset?: Void | null;
    userResetPassword?: Auth | null;
    userListRemoveByIds?: Void | null;
    usageLocationSave?: UsageLocation;
    usageLocationListRemoveByIds?: Void | null;
}
export interface LogEntry {
    __typename?: "LogEntry";
    id?: string | null;
    date?: string;
    level?: string | null;
    class?: string | null;
    method?: string | null;
    message?: string;
    version?: string | null;
    ip?: string;
    host?: string | null;
    user?: string | null;
    email?: string | null;
    telephone?: string | null;
    hasLogsZip?: boolean | null;
    filtered?: boolean | null;
    createdAt?: string | null;
    grouped?: number | null;
    cause?: LogError | null;
    errors?: LogError[];
}
export interface LogEntryListConnection {
    __typename?: "LogEntryListConnection";
    slice?: LogEntry[];
    pageIndex?: number;
    pageCount?: number;
}
export interface LogEntryListConnectionArgs {
    offset?: number | null;
    limit?: number | null;
    orderBy?: OrderBy | null;
    search?: string | null;
    filtered?: boolean | null;
    grouped?: boolean | null;
}
export interface OrderBy {
    col: string;
    dir?: SortDirection | null;
}
export enum SortDirection {
    ASC = "ASC",
    DESC = "DESC"
}
export interface LogEntryStats {
    __typename?: "LogEntryStats";
    count?: number;
    countFiltered?: number;
    countNotFiltered?: number;
    countWithLogsZip?: number;
    dailyReports?: LogEntryDateStats[];
}
export interface LogEntryDateStats {
    __typename?: "LogEntryDateStats";
    date?: string;
    count?: number;
    countFiltered?: number;
    countNotFiltered?: number;
    countWithLogsZip?: number;
}
export interface LogError {
    __typename?: "LogError";
    id?: string | null;
    entry?: LogEntry;
    index?: number;
    class?: string;
    message?: string;
    cause?: LogError | null;
    frames?: LogErrorFrame[];
}
export interface LogErrorFrame {
    __typename?: "LogErrorFrame";
    id?: string | null;
    error?: LogError;
    index?: number;
    className?: string | null;
    methodName?: string | null;
    file?: string | null;
    line?: number | null;
    isNative?: boolean | null;
}
export interface LogFilter {
    __typename?: "LogFilter";
    id?: string | null;
    description?: string;
    jsonPath?: string;
    regexPattern?: string;
    andFilterId?: string | null;
    disabled?: boolean | null;
    createdAt?: string | null;
    noStore?: boolean | null;
    entries?: LogEntry[];
    andFilter?: LogFilter | null;
    parentFilter?: LogFilter | null;
}
export interface LogFilterListArgs {
    dummy?: Void | null;
}
export type Void = unknown;
export interface LogZipRequest {
    __typename?: "LogZipRequest";
    id?: string | null;
    description?: string;
    jsonPath?: string;
    regexPattern?: string;
    pendingRequests?: number | null;
    disabled?: boolean | null;
    createdAt?: string | null;
    entries?: LogEntry[];
}
export interface LogZipRequestListArgs {
    dummy?: Void | null;
}
export interface LogFilterInput {
    id?: string | null;
    description: string;
    jsonPath: string;
    regexPattern: string;
    andFilterId?: string | null;
    disabled?: boolean | null;
    noStore?: boolean | null;
}
export interface LogZipRequestInput {
    id?: string | null;
    description: string;
    jsonPath: string;
    regexPattern: string;
    pendingRequests?: number | null;
    disabled?: boolean | null;
}
export interface AuditLogEntryListConnection {
    __typename?: "AuditLogEntryListConnection";
    slice?: AuditLogEntry[];
    pageIndex?: number;
    pageCount?: number;
}
export interface AuditLogEntry {
    __typename?: "AuditLogEntry";
    id?: string;
    srcTable?: string;
    srcRowid?: Unknown | null;
    updateKind?: string;
    timestamp?: string;
    previousValues?: string;
}
export type Unknown = unknown;
export interface AuditLogEntryListConnectionArgs {
    offset?: number | null;
    limit?: number | null;
    srcTable: string;
    srcRowid?: Unknown | null;
}
export interface ServerLoadResultObject {
    __typename?: "ServerLoadResultObject";
    timestamp?: string;
    requestsPerMinute?: number;
    averageResponseTimeInMs?: number;
    averageSystemLoad?: number;
}
export interface SQLQueryResult {
    __typename?: "SQLQueryResult";
    error?: string | null;
    dataAsJson?: string | null;
}
export interface User {
    __typename?: "User";
    id?: string | null;
    username?: string;
    email?: string;
    roles?: UserRole[];
    activated?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}
export interface UserRole {
    __typename?: "UserRole";
    id?: string | null;
    name?: string;
    description?: string | null;
}
export interface Auth {
    __typename?: "Auth";
    token?: string;
    user?: User;
}
export interface UserInput {
    id?: string | null;
    username: string;
    email: string;
    roles: UserRoleInput[];
    activated?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}
export interface UserRoleInput {
    id?: string | null;
    name: string;
    description?: string | null;
}
export interface UsageCount {
    __typename?: "UsageCount";
    id?: string | null;
    key?: string;
    year?: number;
    month?: number;
    location?: string | null;
    usages?: number;
    locationName?: string | null;
}
export interface UsageCountListConnection {
    __typename?: "UsageCountListConnection";
    slice?: UsageCount[];
    pageIndex?: number;
    pageCount?: number;
}
export interface UsageCountListConnectionArgs {
    offset?: number | null;
    limit?: number | null;
    orderBy?: OrderBy | null;
    search?: string | null;
    previousYear?: boolean | null;
    combineMonths?: boolean | null;
    combineLocations?: boolean | null;
}
export interface UsageLocation {
    __typename?: "UsageLocation";
    id?: string | null;
    key?: string;
    name?: string;
    createdAt?: string | null;
}
export interface UsageLocationListConnectionArgs {
    dummy?: Void | null;
}
export interface UsageLocationInput {
    id?: string | null;
    key: string;
    name: string;
    createdAt?: string | null;
}
