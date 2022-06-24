/**
 *
 * @param db
 * @param userId
 * @param params
 */
function create(db, userId, params) {
    const usage = "Usage: create/c [group/g] account_name group_member1 [group_member2 ...]\n" +
        "\tgroup_member: A pinged user, ex. @Nickname"
    const currentId = db.getData("/info/currentId");

    if(params.length < 1) throw Error(usage)

    let name;
    let accountMembers;

    if (params[0] === "group" || params[0] === "g") {
        params = params.slice(1)

        if (params.length < 1) throw Error(usage)

        name = params[0]
        checkName(name, db)

        accountMembers = params.slice(1).map(m => m.slice(2, -1))
        accountMembers.push(userId)
        accountMembers = accountMembers.filter(onlyUnique)
        for (const accountMember of accountMembers) {
            if (isNaN(parseInt(accountMember)) || accountMember.length !== 18) {
                throw Error(usage)
            }
        }

        db.push("/accounts/" + currentId, {type: "group", owner: userId, name: name, funds: 0, allowFundRemoval: false,
                                            users: accountMembers});
        for (const accountMember of accountMembers) {
            db.push("/userInfo/" + accountMember + "/accounts[]", currentId.toString())
        }

    } else {
        if (params.length > 1) throw Error(usage)

        name = params[0]
        checkName(name, db)

        db.push("/accounts/" + currentId, {type: "user", owner: userId, name: name, funds: 0});
        db.push("/userInfo/" + userId + "/accounts[]", currentId.toString());
    }

    db.push("/accounts/" + currentId, {owner: userId, name: name, funds: 0, decimals: true,
        currency: {symbol: "$", position: "before"}}, false);
    db.push("/info/nameIds/" + name, {id: currentId.toString()});
    db.push("/info/currentId", currentId + 1);


    endMessage("Created Account!\n" + accountString(db.getData("/accounts/" + currentId)))

}


/**
 *
 * @param db
 * @param userId
 * @param params
 */
function deposit(db, userId, params) {
    const usage = "Usage: deposit/d amount [account_name]\n" +
        "\tamount: a positive numeric amount to deposit\n" +
        "\taccount_name: the account name"

    let res = depositWithdrawHelper(db, userId, params, usage)
    let amount = res.amount
    let accountId = res.accountId

    if (checkPermissions(userId, accountId, "deposit", db)) {
        let currentAmount = db.getData("/accounts/" + accountId + "/funds")
        db.push("/accounts/" + accountId + "/funds", currentAmount + amount)
    }

    endMessage(accountFundsMessage(db, "Deposited ", " into ", accountId, amount))
}

/**
 *
 * @param db
 * @param userId
 * @param params
 */
function withdraw(db, userId, params) {
    const usage = "Usage: withdraw/w amount [account_name]\n" +
        "\tamount: a positive numeric amount to deposit\n" +
        "\taccount_name: the account name"



    let res = depositWithdrawHelper(db, userId, params, usage)
    let amount = res.amount
    let accountId = res.accountId
    let accountName = res.accountName
    let currentAmount = 0;

    if (checkPermissions(userId, accountId, "withdraw", db)) {
        if(isNaN(amount) || amount <= 0) {
            throw Error("Withdrawal amount must be a positive number")
        }

        currentAmount = db.getData("/accounts/" + accountId + "/funds")
        let account = db.getData("/accounts/" + accountId)
        if (currentAmount - amount < 0) {
            throw Error(accountFunds(account, amount)
                        + " cannot be withdrawn from " + accountName
                        + ". Current balance: " + accountFunds(account, currentAmount))
        } else {
            db.push("/accounts/" + accountId + "/funds", currentAmount - amount)
        }

    }

    endMessage(accountFundsMessage(db, "Withdrew ", " from ", accountId, amount))
}

function depositWithdrawHelper(db, userId, params, usage) {
    let amount, accountId, accountName
    if (params.length > 1) {
        accountName = params[1]
        checkAccount(db, accountName)
        amount = parseFloat(params[0])
    } else if (params.length === 1) {
        try {
            accountName = db.getData("/userInfo/" + userId + "/defaultAccount")
        } catch (e) {
            throw Error("No default account set. Set a default account with the 'default' command.")
        }

        checkAccount(db, accountName)
        amount = parseFloat(params[0])
    } else {
        throw Error(usage)
    }
    accountId = getAccountId(accountName, db)
    return {accountId: accountId, accountName: accountName, amount: amount}
}

/**
 * default account
 * @param db
 * @param userId
 * @param params
 */
function myDefault(db, userId, params) {
    let usage = "Usage: default account_name\n" +
        "\taccount_name: the account name"
    if (params.length !== 1) {
        throw Error(usage)
    }

    checkAccount(db, params[0])
    if(checkPermissions(userId, params[0], "default", db)) {
        db.push("/userInfo/" + userId + "/defaultAccount", params[0])
    }

    endMessage("Set default account to " + db.getData("/accounts/" + getAccountId(params[0], db) + "/name"))
}

function account(db, userId, params) {
    let usage = "Usage: account [account_name] [-s symbol] [-p symbol_pos] [-d decimals] [-a user] [-r user] [-afr allow_fund_removal]\n" +
        "\tsymbol: a character or string to represent the currency\n" +
        "\tsymbol_pos: left or right\n" +
        "\tdecimals: represented with decimals, true or false\n" +
        "\tuser: a group user to remove or add, accordingly\n" +
        "\tallow_fund_removal: allow all group account users to remove funds, true or false"

    if (params.length === 0) {
        let accounts = db.getData("/userInfo/" + userId + "/accounts")
        let defaultAccount = db.getData("/accounts/" + getAccountId(db.getData("/userInfo/" + userId + "/defaultAccount"), db) + "/name")
        accounts = accounts.map(a => db.getData("/accounts/" + a))
        let message = "**Your accounts:**\n"
        for (const account of accounts) {
            if (account.name === defaultAccount) {
                message += "*"
            }

            if (account.type === "group") {
                message = message + account.name + " " + "[group]: " + accountFunds(account, account.funds)
            } else {
                message = message + account.name + ": " + accountFunds(account, account.funds)
            }

            if (account.name === defaultAccount) {
                message += "*"
            }

            message += "\n"
        }
        endMessage(message)
    } else if (params.length >= 1) {

        let accountId = getAccountId(params[0], db)
        let account = db.getData("/accounts/" + accountId)

        let reserved = ["-s", "-p", "-d", "-a", "-r", "-afr"]
        let finalMessage = "";

        if (params.length === 1) {
            checkPermissions(userId, params[0], "account", db)
            endMessage(accountString(account))
        } else {
            checkPermissions(userId, params[0], "alterAccount", db)
            for (let i = 1; i < params.length; i++) {
                if (reserved.includes(params[i+1]) || i+1 === params.length) {
                    throw Error(finalMessage + usage)
                }

                let accountMembers = []

                switch (params[i]) {
                    case "-s":
                        db.push("/accounts/" + accountId + "/currency/symbol", params[i+1])
                        finalMessage += "changed currency symbol to " + params[i+1] + "\n"
                        i++
                        break;
                    case "-p":
                        if (params[i+1] !== "left" && params[i+1] !== "right") {
                            throw Error(finalMessage + usage)
                        }
                        db.push("/accounts/" + accountId + "/currency/position", params[i+1])
                        finalMessage += "changed symbol position to " + params[i+1] + "\n"
                        i++
                        break;
                    case "-d":
                        if (params[i+1] === "t" || params[i+1] === "true") {
                            db.push("/accounts/" + accountId + "/decimals", true)
                            finalMessage += "changed to decimal representation\n"
                        } else if (params[i+1] === "f" || params[i+1] === "false") {
                            db.push("/accounts/" + accountId + "/decimals", false)
                            finalMessage += "changed to integer representation\n"
                        }
                        i++
                        break;
                    case "-a":
                    case "-r":
                        let c = params[i]
                        let n = 1;
                        if (account.type === "group") {
                            while (!(reserved.includes(params[i+n]) || i+n === params.length)) {
                                accountMembers.push(params[i+n].slice(2, -1))
                                i++
                            }
                            accountMembers = accountMembers.filter(onlyUnique)
                            for (const accountMember of accountMembers) {
                                if (isNaN(parseInt(accountMember)) || accountMember.length !== 18) {
                                    throw Error(finalMessage + usage)
                                }
                            }

                            if (c === "-a") {
                                accountMembers = accountMembers
                                    .concat(db.getData("/accounts/" + accountId + "/users"))
                                    .filter(onlyUnique)
                                db.push("/accounts/" + accountId + "/users", accountMembers)
                                finalMessage += "Added new users\n"
                            } else if (c === "-r") {
                                let oldAccounts = db.getData("/accounts/" + accountId + "/users")
                                let newAccountMembers = oldAccounts.filter(item => (!accountMembers.includes(item) || item === userId))
                                db.push("/accounts/" + accountId + "/users", newAccountMembers)
                                finalMessage += "Removed users\n"
                            }

                        } else {
                            throw Error(finalMessage + usage)
                        }
                        break;
                    case "-afr":
                        if (account.type === "group") {
                            if (params[i+1] === "t" || params[i+1] === "true") {
                                db.push("/accounts/" + accountId + "/allowFundRemoval", true)
                                finalMessage += "allowed all users to remove funds\n"
                            } else if (params[i+1] === "f" || params[i+1] === "false") {
                                db.push("/accounts/" + accountId + "/allowFundRemoval*/", false)
                                finalMessage += "prevented all users from removing funds\n"
                            }
                        } else {
                            throw Error(finalMessage + usage)
                        }
                        i++
                        break;

                }
            }
        }

        endMessage(finalMessage)

    }
}

function transfer(db, userId, params) {
    let usage = "Usage: transfer/t amount source_account destination_account"
    if (params.length === 3) {
        let amount = parseFloat(params[0])
        if(isNaN(amount) || amount <= 0) {
            throw Error("Transfer amount must be a positive number")
        }
        checkPermissions(userId, params[1], "transfer", db)
    
        let id0
        let id1
        
        try {
            id0 = getAccountId(params[1], db)
        } catch (e) { throw Error("Account " + params[1] + " does not exist")}
        try {
            id1 = getAccountId(params[2], db)
        } catch (e) { throw Error("Account " + params[2] + " does not exist")}

        let sourceAccount = db.getData("/accounts/"+ id0)
        let destAccount = db.getData("/accounts/"+ id1)

        if (amount > sourceAccount.funds) {
            throw Error(accountFunds(account, amount)
                + " cannot be transferred from " + sourceAccount.name
                + ". Current balance: " + accountFunds(sourceAccount, sourceAccount.funds))
        } else {
            db.push("/accounts/"+ id1 + "/funds", destAccount.funds + amount)
            db.push("/accounts/"+ id0 + "/funds", sourceAccount.funds - amount)
        }
        sourceAccount = db.getData("/accounts/"+ id0)
        destAccount = db.getData("/accounts/"+ id1)
        endMessage(accountFunds(sourceAccount, amount) + " transferred to " + destAccount.name
                    + "\n" + sourceAccount.name + ": " + accountFunds(sourceAccount, sourceAccount.funds)
                    + "\n" + destAccount.name + ": " + accountFunds(destAccount, destAccount.funds))

    } else {
        throw Error(usage)
    }
}

function myDelete(db, userId, params) {
    let usage = "Usage: delete account_name account_name\n" +
        "\taccount name must be repeated for confirmation"
    if (params.length !== 2 || params[0] !== params[1]) {
        throw Error(usage)
    }
    let account = getAccount(db, params[0])
    let accountId = getAccountId(params[0], db)
    checkPermissions(userId, params[0], "delete", db)
    if (account.type === "group") {
        for (const user of account.users) {
            let accounts = db.getData("/userInfo/" + user + "/accounts")
            accounts = accounts.filter(a => a !== accountId)
            db.push("/userInfo/" + user + "/accounts", accounts)
        }
    } else {
        let accounts = db.getData("/userInfo/" + userId + "/accounts")
        accounts = accounts.filter(a => a !== accountId)
        db.push("/userInfo/" + userId + "/accounts", accounts)
    }
    db.delete("/accounts/" + accountId)
    db.delete("/info/nameIds/" + account.name)
    endMessage(account.name + " has been deleted")
}

function checkName(name, db) {
    try {
        db.getData("/info/nameIds/" + name)
    } catch (e) {
        if(!isNaN(parseFloat(name))) {
            throw Error("Account name \"" + name + "\" cannot be a number.")
        }
        return
    }
    throw Error("Account name \"" + name + "\" already exists.")
}

function getAccountId(accountNameId, db) {
    let id = parseInt(accountNameId)
    if (isNaN(id)) {
        return db.getData("/info/nameIds/" + accountNameId.toString() + "/id")
    } else {
        return id.toString()
    }
}

function endMessage(message) {
    throw Error(message)
}

function accountFunds(account, amt) {

    if (account.decimals) {
        amt = amt.toFixed(2)
    } else {
        amt = amt.toFixed(0)
    }
    if (account.currency.position === "before") {
        amt = account.currency.symbol + amt
    } else {
        amt = amt + account.currency.symbol
    }
    return amt
}

function accountFundsMessage(db, message0, message1, account, amount) {
    account = db.getData("/accounts/" + account)

    let amt = account.funds
    let amt2
    if (account.decimals) {
        amt = amt.toFixed(2)
        amt2 = amount.toFixed(2)
    } else {
        amt = amt.toFixed(0)
        amt2 = amount.toFixed(0)
    }
    if (account.currency.position === "before") {
        amt = account.currency.symbol + amt
        amt2 = account.currency.symbol + amt2
    } else {
        amt = amt + account.currency.symbol
        amt2 = amt2 + account.currency.symbol
    }

    return message0 + amt2 + message1 + account.name + ", new amount: " + amt
}

function accountString(account) {

    let amt = accountFunds(account, account.funds)

    let groupUsers = ""
    if (account.type === "group") {
        groupUsers = "Owner: " + "<@" + account.owner + ">\n"
                    + "Users: "
                    + account.users.map(u => "<@" + u + ">").join(" ") + "\n"
                    + "Allow user fund removal: " + account.allowFundRemoval
    }

    return        "" +
        "**" + account.name + "**\n"
        + amt + "\n"
        + groupUsers +
        ""
}

function checkAccount(db, accountNameId) {
    try {
        db.getData("/accounts/" + getAccountId(accountNameId, db))
    } catch (e) {
        throw Error("Account \'" + accountNameId + "\' does not exist")
    }
}

function getAccount(db, accountNameId) {
    try {
        return db.getData("/accounts/" + getAccountId(accountNameId, db))
    } catch (e) {
        throw Error("Account \'" + accountNameId + "\' does not exist")
    }
}

function checkPermissions(userId, accountNameId, action, db) {
    let id = getAccountId(accountNameId, db)
    let account = db.getData("/accounts/" + id)
    let removalActions = ["withdraw", "transfer"]
    let result
    if (account.type === "group") {
        result = account.owner === userId.toString() ||
                (account.users.includes(userId.toString())
                && (account.allowFundRemoval || !(removalActions.includes(action))) //allow fund removal or not removing funds
                && (account.owner === userId.toString()) || (action !== "delete" && action !== "account")) //user is owner or account not being deleted
    } else {
        result = account.owner === userId.toString()
    }
    if (result) return result;

    switch(action) {
        case "withdraw":
        case "transfer":
            throw Error("You do not have permission to " + action + " from this account")
        case "delete":
            throw Error("You do not have permission to " + action + " this account")
        case "account":
            throw Error("You do not have permission to view or edit this account's settings")
    }

    throw Error("You do not have permission to " + action + " with this account")
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

module.exports = { create, myDefault, deposit, withdraw, account, transfer, myDelete};
