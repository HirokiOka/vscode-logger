import * as path from 'path';
import * as vscode from 'vscode';
import { parseScript } from 'esprima';
import { ted } from 'edit-distance';
import fetch from 'node-fetch';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '..', '.env') });

const MONGO_API_ENDPOINT: string = process.env.MONGO_API_ENDPOINT || '';
const MONGO_API_KEY: string = process.env.MONGO_API_KEY || '';
const CLASS_CODE: string = process.env.CLASS_CODE || '';
const MIMAMORI_CODER_API_ENDPOINT: string = process.env.MIMAMORI_CODER_API_ENDPOINT || '';

async function insertOne(endpoint: string, option: any) {
  const res = await fetch(endpoint, option);
  const resJson = await res.json();
  return resJson;
}


function calcTed(lastSourceCode: string, currentSourceCode: string): number {
  const lastAst = parseScript(lastSourceCode);
  const currentAst = parseScript(currentSourceCode);

  let insert = function(node: any) { return 1; };
  let remove = insert;
  let update = function(nodeA: any, nodeB: any) { 
    return nodeA.body !== nodeB.body ? 1 : 0;
  };
  let children = function(node: any) { return node.body; };

  let astEditDistance: number = 0;
  try {
    astEditDistance = ted(lastAst, currentAst, children, insert, remove, update).distance;
  } catch (e) {
    console.log(e);
  }
  return astEditDistance;
}


export async function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('js-logger is activated');

  let studentId: any = context.workspaceState.get('studentId');
  if (studentId === undefined) {
    studentId = await vscode.window.showInputBox();
    context.workspaceState.update('studentId', studentId);
    vscode.window.showInformationMessage(`Student ID ${studentId} is registered.`);
  } else {
    vscode.window.showInformationMessage(`Your student ID: ${studentId}`);
  }

  let lastSourceCode: string = ''; 

  vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
    if (document.languageId !== 'javascript') return;
    studentId = context.workspaceState.get('studentId');
    const currentDate: string = new Date().toLocaleString(); 
    const sourceCode: string = document.getText();
    const sloc: number = sourceCode.split('\n').length;
    const ted: number = calcTed(lastSourceCode, sourceCode);
    const wsName: any = vscode.workspace.name;
    const filePath = vscode.window.activeTextEditor === undefined ? '' : vscode.window.activeTextEditor.document.uri.fsPath;
    const filename = path.basename(filePath);

    try {
      const mongoOption = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Request-Headers': '*',
            'api-key': MONGO_API_KEY
        },
        body: JSON.stringify({
            'collection': 'codeparams',
            'database': 'test',
            'dataSource': 'Cluster0',
            'document': {
              'studentId': studentId,
              'filename': filename,
              'workspace': wsName,
              'savedAt': currentDate,
              'code': sourceCode,
              'sloc': sloc,
              'ted': ted
            }
          })
      };
      const res = await insertOne(MONGO_API_ENDPOINT, mongoOption);
      vscode.window.showInformationMessage(`code saved to mongo: ${res.insertedId}`);
    } catch (e: any) {
      vscode.window.showInformationMessage(e.message);
    }

    try {
    const mimamoriOption = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Request-Headers': '*'
        },
        body: JSON.stringify({
            'classCode': CLASS_CODE,
            'document': {
              'studentId': studentId,
              'filename': filename,
              'workspace': wsName,
              'savedAt': currentDate,
              'code': sourceCode,
              'sloc': sloc,
              'ted': ted
            }
          })
        };
      const res = await insertOne(MIMAMORI_CODER_API_ENDPOINT, mimamoriOption);
      vscode.window.showInformationMessage(`code saved to mimamori coder: ${res.status}`);
    } catch (e: any) {
      vscode.window.showInformationMessage(e.message);
    }

    lastSourceCode = sourceCode;
  });

  const disposable = vscode.commands.registerCommand('studentId.change', async () => {
    const newId: any = await vscode.window.showInputBox();
    context.workspaceState.update('studentId', newId);
    vscode.window.showInformationMessage(`your student ID :${newId}`);
  });

  context.subscriptions.push(disposable);
}


export function deactivate() {};
