import * as path from 'path';
import * as vscode from 'vscode';
import { parseScript } from 'esprima';
import { ted } from 'edit-distance';
import fetch from 'node-fetch';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '..', '.env') });


const API_ENDPOINT: any = process.env.API_ENDPOINT;
const API_KEY: any = process.env.API_KEY;

async function insertOne(id: string, workspaceName: string, savedAt: string, code: string, sloc: number, ted: number) {
  const filePath = vscode.window.activeTextEditor === undefined ? '' : vscode.window.activeTextEditor.document.uri.fsPath;
  const filename = path.basename(filePath);
  vscode.window.showInformationMessage(`filename: ${filename}`);
  const options = {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Access-Control-Request-Headers': '*',
          'api-key': API_KEY
      },
      body: JSON.stringify({
          'collection': 'codeparams',
          'database': 'test',
          'dataSource': 'Cluster0',
          'document': {
            'id': id,
            'workspace': workspaceName,
            'filename': filename,
            'savedAt': savedAt,
            'code': code,
            'sloc': sloc,
            'ted': ted
          }
        })
      };

  const res = await fetch(API_ENDPOINT, options);
  const resJson = await res.json();
  return resJson.insertedId;
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

    try {
      const res = await insertOne(studentId, wsName, currentDate, sourceCode, sloc, ted);
      vscode.window.showInformationMessage(`code saved: ${res}`);
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
