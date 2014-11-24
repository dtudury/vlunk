#!/usr/bin/env node

require('colors');

var parser;
var stack;
var quotes;
var braces;
var brackets;

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on("data", on_data);
process.stdin.on("end", on_end);

function on_data(chunk) {
    for (var i = 0; i < chunk.length; i++) {
        parser(chunk.charAt(i));
    }
}

function on_end() {
    print_line('\n');
}

function space_parser (c) {
    if (c.match(/\s/)) {
        stack[0].str += c;
    } else {
        parser = default_parser;
        stack.unshift({str:'', type:"word"});
        parser(c);
    }
}

function json_parser (c) {
    if (c === '\n' || c === '\r') {
        return print_line(c);
    }
    switch (c) {
        case '"': quotes = 1 - quotes; break;
        case '{': braces++; break;
        case '}': braces--; break;
        case '[': brackets++; break;
        case ']': brackets--; break;
    }
    stack[0].str += c;
    if (!quotes && !braces && !brackets) {
        var str = stack[0].str;
        if (str.indexOf('"') === 0) {
            if (str.indexOf('[') === 1 || str.indexOf('{') === 1) {
                try {
                    str = str.substring(1, str.length - 1);
                    stack[0].str = '"' + JSON.stringify(JSON.parse(str)) + '"';
                    stack[0].type = "json";
                } catch (e) {
                    stack[0].type = "string";
                }
            } else {
                stack[0].type = "string";
            }
        } else {
            try {
                stack[0].str = JSON.stringify(JSON.parse(str));
                stack[0].type = "json";
            } catch (e) {
            }
        }
        parser = default_parser;
        stack.unshift({str:'', type:"word"});
    }
}

function default_parser (c) {
    if (c === '\r' || c === '\n') {
        print_line(c);
    } else if (c === '=') {
        stack.unshift({str:c, type:"equal"});
        stack.unshift({str:'', type:"word"});
    } else if (c.match(/\s/)) {
        parser = space_parser;
        stack.unshift({str:c, type:"space"});
    } else if (c === '"' || c === '[' || c === '{') {
        quotes = 0;
        braces = 0;
        brackets = 0;
        parser = json_parser;
        stack.unshift({str:'', type:"bad_json"});
        parser(c);
    } else {
        stack[0].str += c;
    }
}

function print_line(eol) {
    if(stack.length > 1 || stack[0].length > 0) {
        var some_success = false;
        var short_stack = stack.filter(function (token) {
            return token.str.length && token.type !== "space" && token.type !== "bad_json";
        });
        for (var i = short_stack.length - 1; i >= 0; i--) {
            var token = short_stack[i];
            if (token.str.match(/^"?[\d.]*"?$/)) {
                token.type = "number";
            }
        }
        for (var i = short_stack.length - 2; i > 0; i--) {
            var token = short_stack[i];
            var next_token = short_stack[i - 1];
            var prev_token = short_stack[i + 1];
            if (token.type === "equal") {
                if (prev_token.type === "word" && next_token.type !== "equal") {
                    prev_token.type = "name";
                    next_token.type += "_value";
                    next_token.name = prev_token.str;
                    some_success = true;
                } else {
                    prev_token.type += "_bad";
                    token.type += "_bad";
                    next_token.type += "_bad";
                }
            }
        }
        while (stack.length) {
            var token = stack.pop();
            if (token.name === "loglevel") {
                switch (token.str.toUpperCase()) {
                    case '"TRACE"': process.stdout.write(token.str.grey); break;
                    case '"DEBUG"': process.stdout.write(token.str.green); break;
                    case '"INFO"': process.stdout.write(token.str.white); break;
                    case '"WARN"': process.stdout.write(token.str.magenta); break;
                    case '"ERROR"': process.stdout.write(token.str.red); break;
                    case '"FATAL"': process.stdout.write(token.str.inverse); break;
                    default: process.stdout.write(token.str.yellow); break;
                }
            } else {
                switch (token.type) {
                    case "space": process.stdout.write(token.str); break;
                    case "equal": process.stdout.write(token.str.grey); break;
                    case "bad_json": process.stdout.write(token.str.red); break;
                    case "json_value": process.stdout.write(token.str.cyan); break;
                    case "word_value": process.stdout.write(token.str.white); break;
                    case "string_value": process.stdout.write(token.str.green); break;
                    case "number_value": process.stdout.write(token.str.yellow); break;
                    case "name": process.stdout.write(token.str.grey); break;
                    default: process.stdout.write(some_success ? token.str.yellow : token.str.magenta); break;
                }
            }
        }
    }
    process.stdout.write(eol);
    init();
}

function init() {
    parser = default_parser;
    stack = [{str:'', type:"word"}];
}

init();

