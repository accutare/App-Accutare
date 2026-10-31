// Interface language. The app is written in English; when Portuguese is chosen every piece of
// interface text is translated on the fly (including modals, toasts and confirm/prompt dialogs).
// To add a language, add a dictionary like PT and an entry in LANGS.
import { setLocale } from './utils.js';

export const LANGS = [['en', 'English'], ['pt', 'Português (Brasil)']];

const PT = {
  // navigation & shell
  'Dashboard': 'Painel', 'Banking': 'Banco', 'Sales': 'Vendas', 'Invoices': 'Faturas', 'Estimates': 'Orçamentos', 'Sales receipts': 'Recibos de venda',
  'Credit notes': 'Notas de crédito', 'Recurring': 'Recorrentes', 'Customers': 'Clientes', 'Products & stock': 'Produtos e estoque', 'Purchases': 'Compras',
  'Bills': 'Contas a pagar', 'Purchase orders': 'Pedidos de compra', 'Expenses': 'Despesas', 'Suppliers': 'Fornecedores', 'Work': 'Trabalho', 'Projects': 'Projetos',
  'Time': 'Horas', 'Mileage': 'Quilometragem', 'Payroll': 'Folha de pagamento', 'Accounting': 'Contabilidade', 'Reports': 'Relatórios', 'VAT returns': 'Declarações de VAT',
  'Chart of accounts': 'Plano de contas', 'Fixed assets': 'Ativo imobilizado', 'Budgets': 'Orçamento anual', 'Settings': 'Configurações', 'More': 'Mais', 'New': 'Novo',
  'Search everything…': 'Buscar em tudo…', 'Search': 'Buscar', 'Switch company': 'Trocar de empresa', '+ Add a company': '+ Adicionar empresa',
  'Local mode · data stays in this browser': 'Modo local · dados só neste navegador', 'Audit log': 'Histórico de alterações',
  'Products & services': 'Produtos e serviços', 'Credit notes & payments on account': 'Notas de crédito e pagamentos antecipados', 'Customer statement': 'Extrato do cliente',
  'Supplier credits': 'Créditos de fornecedor', 'Pay bills': 'Pagar contas', 'Recurring invoices': 'Faturas recorrentes',
  // new menu
  'Invoice': 'Fatura', 'Estimate': 'Orçamento', 'Sales receipt': 'Recibo de venda', 'Credit note': 'Nota de crédito', 'Customer': 'Cliente', 'Bill': 'Conta',
  'Expense': 'Despesa', 'Purchase order': 'Pedido de compra', 'Supplier credit': 'Crédito de fornecedor', 'Supplier': 'Fornecedor', 'Other': 'Outros',
  'Time entry': 'Lançamento de horas', 'Mileage trip': 'Viagem (quilometragem)', 'Journal entry': 'Lançamento contábil',
  // common actions
  'Save': 'Salvar', 'Cancel': 'Cancelar', 'Edit': 'Editar', 'Delete': 'Excluir', 'Close': 'Fechar', 'Add': 'Adicionar', 'Add line': 'Adicionar linha', 'Remove line': 'Remover linha',
  'Print': 'Imprimir', 'Print / PDF': 'Imprimir / PDF', 'Export CSV': 'Exportar CSV', 'Send by email': 'Enviar por e-mail', 'Resend by email': 'Reenviar por e-mail', 'Review': 'Revisar',
  'Record': 'Registrar', 'Match': 'Vincular', 'Exclude': 'Excluir da revisão', 'Undo': 'Desfazer', 'Apply': 'Aplicar', 'Refund': 'Reembolsar', 'Start': 'Iniciar', 'View all': 'Ver tudo',
  'Yes': 'Sim', 'No': 'Não', 'On': 'Ligada', 'Off': 'Desligada', 'OK': 'OK', 'or': 'ou', 'to': 'a', 'From': 'De', 'To': 'Para', 'Next': 'Próximo', 'Remove': 'Remover',
  'Save settings': 'Salvar configurações', 'Save branding': 'Salvar marca', 'Save payment': 'Salvar pagamento', 'Save rule': 'Salvar regra', 'Save journal': 'Salvar lançamento',
  'Save as draft': 'Salvar como rascunho', 'Save invoice': 'Salvar fatura', 'Save estimate': 'Salvar orçamento', 'Save credit note': 'Salvar nota de crédito',
  'Save sales receipt': 'Salvar recibo de venda', 'Save bill': 'Salvar conta', 'Save supplier credit': 'Salvar crédito de fornecedor', 'Save pay run': 'Salvar folha',
  // fields
  'Name': 'Nome', 'Name / company': 'Nome / empresa', 'Email': 'E-mail', 'Phone': 'Telefone', 'Address': 'Endereço', 'Billing address': 'Endereço de cobrança', 'Notes': 'Observações',
  'Date': 'Data', 'Due date': 'Vencimento', 'Due': 'Vence', 'Amount': 'Valor', 'Total': 'Total', 'Subtotal': 'Subtotal', 'Balance': 'Saldo', 'Balance due': 'Saldo devedor',
  'Status': 'Situação', 'Description': 'Descrição', 'Category': 'Categoria', 'Qty': 'Qtd', 'Rate': 'Preço', 'Price': 'Preço', 'VAT': 'VAT', 'VAT %': 'VAT %', 'Disc %': 'Desc %', 'Disc': 'Desc',
  'Method': 'Forma', 'Payment method': 'Forma de pagamento', 'Payment date': 'Data do pagamento', 'Memo': 'Memorando', 'Project': 'Projeto', 'Currency': 'Moeda', 'Type': 'Tipo',
  'Code': 'Código', 'Account': 'Conta', 'Account name': 'Nome da conta', 'Product': 'Produto', 'Product / service': 'Produto / serviço', 'Product / description': 'Produto / descrição',
  'No.': 'Nº', 'Ref': 'Ref.', 'Details': 'Detalhes', 'Transaction': 'Transação', 'Debit': 'Débito', 'Credit': 'Crédito', 'Value': 'Valor', 'Period': 'Período', 'Periods': 'Períodos',
  'Template': 'Modelo', 'Repeat': 'Repetir', 'Repeats': 'Repete', 'Margin': 'Margem', 'Profit': 'Lucro', 'Costs': 'Custos', 'Cost': 'Custo', 'Hours': 'Horas', 'Purpose': 'Finalidade',
  'Journey': 'Trajeto', 'Miles': 'Milhas', 'Claim': 'Reembolso', 'Employee': 'Funcionário', 'Gross': 'Bruto', 'Salary': 'Salário', 'Pension': 'Pensão', 'Net pay': 'Salário líquido',
  'Unit cost': 'Custo unitário', 'On hand': 'Em estoque', 'Paid': 'Pago', 'Payment': 'Pagamento', 'Payments': 'Pagamentos', 'Received': 'Recebido', 'Spent': 'Gasto', 'Charges': 'Débitos',
  'Box': 'Caixa', 'Suggestion': 'Sugestão', 'Then': 'Então', 'Applies to': 'Aplica-se a', 'Both': 'Ambos', 'Payee': 'Favorecido', 'Payee / supplier': 'Favorecido / fornecedor',
  '— None —': '— Nenhum —', '— No project —': '— Sem projeto —', '— Custom —': '— Personalizado —', 'Select a customer…': 'Selecione um cliente…', 'Select a supplier…': 'Selecione um fornecedor…',
  '+ Add new customer': '+ Adicionar novo cliente', '+ Add new supplier': '+ Adicionar novo fornecedor', 'Message on invoice': 'Mensagem na fatura', 'Message to supplier': 'Mensagem ao fornecedor',
  // statuses
  'Draft': 'Rascunho', 'Open': 'Em aberto', 'Partially paid': 'Pago em parte', 'Overdue': 'Vencida', 'Pending': 'Pendente', 'Accepted': 'Aceito', 'Declined': 'Recusado',
  'Invoiced': 'Faturado', 'Expired': 'Expirado', 'Active': 'Ativo', 'Paused': 'Pausado', 'Left': 'Desligado', 'Unbilled': 'Não faturado', 'Non-billable': 'Não faturável',
  'Available': 'Disponível', 'Used': 'Usado', 'Partly used': 'Usado em parte', 'Billed': 'Faturado', 'In progress': 'Em andamento', 'On hold': 'Em espera', 'Completed': 'Concluído',
  'Not filed': 'Não entregue', 'To file': 'A entregar', 'Period open': 'Período em aberto', 'Up to date': 'Em dia', 'Unpaid': 'Não pagas', 'To pay': 'A pagar', 'All': 'Todas', 'Reorder': 'Repor',
  // dashboard
  'Income (YTD)': 'Receita (no ano)', 'Expenses (YTD)': 'Despesas (no ano)', 'Net profit (YTD)': 'Lucro líquido (no ano)', 'Bills to pay': 'Contas a pagar',
  'Income vs expenses — last 6 months': 'Receitas x despesas — últimos 6 meses', 'Recent invoices': 'Faturas recentes', 'Income': 'Receitas', 'To do': 'Pendências',
  'New invoice': 'Nova fatura', 'New expense': 'Nova despesa', 'New customer': 'Novo cliente', 'New bill': 'Nova conta', 'Log time': 'Lançar horas', 'Log trip': 'Lançar viagem',
  'Bank balance': 'Saldo bancário', 'No invoices yet.': 'Nenhuma fatura ainda.',
  // banking
  'Bank': 'Banco', 'Credit card': 'Cartão de crédito', 'Add account': 'Adicionar conta', 'Bank balance (statement)': 'Saldo no banco (extrato)', 'In your books': 'Na contabilidade',
  'Reconciled balance': 'Saldo conciliado', 'Categorised': 'Categorizadas', 'Reconcile': 'Conciliar', 'Import / add': 'Importar / adicionar', 'Added as': 'Lançado como',
  'Money in': 'Entrada', 'Money out': 'Saída', 'Categorise': 'Categorizar', 'Transfer / other': 'Transferência / outra', 'Create rule': 'Criar regra',
  'Split into several categories': 'Dividir em várias categorias', 'Add split': 'Adicionar divisão', 'Fully assigned ✓': 'Totalmente distribuído ✓', 'Amount (incl. VAT)': 'Valor (com VAT)',
  'Money came from': 'O dinheiro veio de', 'Money went to': 'O dinheiro foi para', 'Choose CSV / OFX / QFX file': 'Escolher arquivo CSV / OFX / QFX',
  'Or add one transaction by hand:': 'Ou adicione uma transação manualmente:', 'Amount (negative = money out)': 'Valor (negativo = saída)', 'Add transaction': 'Adicionar transação',
  'Statement end date': 'Data final do extrato', 'Statement ending balance': 'Saldo final do extrato', 'Beginning balance': 'Saldo inicial', 'Cleared balance': 'Saldo conferido',
  'Difference': 'Diferença', 'Finish reconciling': 'Concluir conciliação', 'Nothing to reconcile.': 'Nada para conciliar.', 'All caught up — nothing to review.': 'Tudo em dia — nada para revisar.',
  'Nothing categorised yet.': 'Nada categorizado ainda.', 'New rule': 'Nova regra', 'New bank rule': 'Nova regra bancária', 'Edit rule': 'Editar regra', 'Rule': 'Regra', 'Rule name': 'Nome da regra',
  'When description contains': 'Quando a descrição contém', 'Auto-add': 'Lançar sozinho', 'Apply rules to “For review”': 'Aplicar regras em “Para revisar”',
  'Rules categorise matching bank lines for you. Turn on “add automatically” to skip the review.': 'As regras categorizam as linhas do banco por você. Ative “lançar automaticamente” para pular a revisão.',
  'No rules yet. Tip: when reviewing a transaction, click “Create rule”.': 'Nenhuma regra ainda. Dica: ao revisar uma transação, clique em “Criar regra”.',
  'Description contains (use | for “or”)': 'Descrição contém (use | para “ou”)', 'Min amount (optional)': 'Valor mínimo (opcional)', 'Max amount (optional)': 'Valor máximo (opcional)',
  'Only for account': 'Só para a conta', 'All bank accounts': 'Todas as contas bancárias', 'Record as transfer / other account': 'Registrar como transferência / outra conta',
  'VAT % included': 'VAT % incluído', 'Payee name (optional)': 'Nome do favorecido (opcional)', 'Transfer account': 'Conta de transferência',
  'Add automatically (skip review)': 'Lançar automaticamente (sem revisão)', 'No – suggest only': 'Não – apenas sugerir', 'e.g. shell | bp | esso': 'ex.: shell | bp | esso',
  'Use for transfers between your own accounts, credit card repayments, loans, VAT/PAYE payments to HMRC, money you put in or take out.': 'Use para transferências entre suas contas, pagamento do cartão, empréstimos, pagamentos de VAT/PAYE ao HMRC e dinheiro que você coloca ou retira.',
  'Upload a CSV exported from your online banking. Columns needed: date, description and either': 'Envie um CSV exportado do internet banking. Colunas necessárias: data, descrição e',
  'paid in / paid out': 'entrada / saída', 'amount': 'valor', '. Duplicates are skipped.': '. Duplicadas são ignoradas.', 'Calculate VAT at 20%': 'Calcular VAT de 20%',
  // invoices & sales
  'Invoice no.': 'Nº da fatura', 'Invoice date': 'Data da fatura', 'Estimate no.': 'Nº do orçamento', 'Estimate date': 'Data do orçamento', 'Expiry date': 'Validade',
  'Credit note no.': 'Nº da nota de crédito', 'Credit note date': 'Data da nota de crédito', 'Sales receipt no.': 'Nº do recibo', 'Sales receipt date': 'Data do recibo',
  'Exchange rate (1 unit = ? GBP)': 'Câmbio (1 unidade = ? GBP)', 'Deposit to': 'Depositar em', 'Cash sale (no customer)': 'Venda à vista (sem cliente)',
  'Receive payment': 'Receber pagamento', 'Make recurring': 'Tornar recorrente', 'Apply credit': 'Aplicar crédito', 'Send reminder': 'Enviar lembrete', 'Bill to': 'Cobrar de',
  'How to pay': 'Como pagar', 'Pay online': 'Pagar online', 'Amount received': 'Valor recebido', 'Tip: payments that arrive in your bank feed can be matched in Banking instead.': 'Dica: pagamentos que chegam no banco podem ser vinculados em Banco.',
  'Convert to invoice': 'Converter em fatura', 'Mark declined': 'Marcar como recusado', 'View invoice': 'Ver fatura', 'Prepared for': 'Preparado para', 'Valid until': 'Válido até',
  'New estimate': 'Novo orçamento', 'New credit note': 'Nova nota de crédito', 'New sales receipt': 'Novo recibo de venda', 'Statement': 'Extrato', 'Open balance': 'Saldo em aberto',
  'Credit to': 'Crédito para', 'Credit total': 'Total do crédito', 'Apply to invoice': 'Aplicar em fatura', 'Payment on account': 'Pagamento antecipado', 'Refund to customer': 'Reembolso ao cliente',
  'Record refund': 'Registrar reembolso', 'Apply automatically (oldest first)': 'Aplicar automaticamente (mais antigas primeiro)', 'Paid by': 'Pago com', 'Total paid': 'Total pago',
  'For sales paid on the spot (card, cash) — no invoice needed.': 'Para vendas pagas na hora (cartão, dinheiro) — sem precisar de fatura.', 'No sales receipts yet.': 'Nenhum recibo de venda ainda.',
  'No credit notes. Issue one to reduce what a customer owes, or record a payment on account from the customer page.': 'Nenhuma nota de crédito. Emita uma para reduzir o que o cliente deve, ou registre um pagamento antecipado na página do cliente.',
  'Applied to the oldest open invoices first. Anything left over is kept as a payment on account (deposit).': 'Aplicado primeiro nas faturas mais antigas. O que sobrar fica como pagamento antecipado (crédito).',
  'Balance brought forward': 'Saldo anterior', 'Amount due': 'Valor devido', 'In credit': 'Em crédito', 'Account': 'Conta',
  'Invoices are created automatically on their date when the app is opened.': 'As faturas são criadas automaticamente na data, quando o app é aberto.',
  'New template': 'Novo modelo', 'New recurring invoice': 'Nova fatura recorrente', 'Edit recurring invoice': 'Editar fatura recorrente', 'Template name': 'Nome do modelo',
  'Next invoice date': 'Próxima fatura em', 'End date (optional)': 'Data final (opcional)', 'Create as': 'Criar como', 'Ready to send': 'Pronta para enviar', 'Draft (review first)': 'Rascunho (revisar antes)',
  'Weekly': 'Semanal', 'Every 2 weeks': 'Quinzenal', 'Monthly': 'Mensal', 'Every 3 months': 'Trimestral', 'Yearly': 'Anual',
  // customers / suppliers / products
  'Search customers': 'Buscar clientes', 'Search suppliers': 'Buscar fornecedores', 'Search invoices': 'Buscar faturas', 'Search estimates': 'Buscar orçamentos', 'Search bills': 'Buscar contas',
  'Search expenses': 'Buscar despesas', 'Search products': 'Buscar produtos', 'Search receipts': 'Buscar recibos', 'Search time': 'Buscar horas', 'Search trips': 'Buscar viagens',
  'Search accounts': 'Buscar contas', 'Search purchase orders': 'Buscar pedidos de compra', 'Edit customer': 'Editar cliente', 'Edit supplier': 'Editar fornecedor', 'New supplier': 'Novo fornecedor',
  'Supplier name': 'Nome do fornecedor', 'You owe': 'Você deve', 'Edit product / service': 'Editar produto / serviço', 'New product / service': 'Novo produto / serviço',
  'Sales price / rate': 'Preço de venda', 'Description (shown on invoices)': 'Descrição (aparece na fatura)', 'Track stock?': 'Controlar estoque?', 'No – service / non-stock': 'Não – serviço / sem estoque',
  'Yes – track quantity': 'Sim – controlar quantidade', 'Purchase cost (per unit)': 'Custo de compra (unitário)', 'Opening quantity': 'Quantidade inicial', 'Reorder when at or below': 'Repor quando chegar a',
  'Adjust stock': 'Ajustar estoque', 'Credit note': 'Nota de crédito',
  // bills & purchasing
  'Bill no. / reference': 'Nº / referência da conta', 'Bill date': 'Data da conta', 'Pay bill': 'Pagar conta', 'Apply supplier credit': 'Aplicar crédito de fornecedor', 'Edit bill': 'Editar conta',
  'Amount (net)': 'Valor (sem VAT)', 'PO no.': 'Nº do pedido', 'Expected delivery': 'Entrega prevista', 'New purchase order': 'Novo pedido de compra', 'Receive & bill': 'Receber e lançar conta',
  'No purchase orders yet.': 'Nenhum pedido de compra ainda.', 'New supplier credit': 'Novo crédito de fornecedor', 'No supplier credits.': 'Nenhum crédito de fornecedor.',
  'Credit notes you received from suppliers (returns, refunds, discounts).': 'Notas de crédito recebidas de fornecedores (devoluções, reembolsos, descontos).',
  'Pay from': 'Pagar de', 'Paid from': 'Pago de', 'Pay selected': 'Pagar selecionadas', 'Total to pay:': 'Total a pagar:', 'Open': 'Em aberto', 'Expected': 'Previsto',
  'Payee / supplier': 'Favorecido / fornecedor', 'Total amount (incl. VAT)': 'Valor total (com VAT)', 'VAT included': 'VAT incluído', 'Personal funds': 'Dinheiro pessoal',
  'Default / by method': 'Padrão / pela forma', 'Add receipt photo': 'Adicionar foto do recibo', 'Replace receipt photo': 'Trocar foto do recibo', 'Read receipt automatically': 'Ler recibo automaticamente',
  'Edit expense': 'Editar despesa', 'Card': 'Cartão', 'Bank transfer': 'Transferência bancária', 'Cash': 'Dinheiro', 'Direct debit': 'Débito automático', 'Cheque': 'Cheque',
  // projects, time, mileage
  'New project': 'Novo projeto', 'Edit project': 'Editar projeto', 'Project name': 'Nome do projeto', 'Budget (income)': 'Orçamento (receita)', 'Start date': 'Data de início', 'End date': 'Data final',
  'Track income, costs and time per job.': 'Acompanhe receitas, custos e horas por trabalho.', 'Costs (incl. labour)': 'Custos (com mão de obra)', 'Hours · unbilled': 'Horas · não faturadas',
  'Labour': 'Mão de obra', 'Hours last 7 days': 'Horas nos últimos 7 dias', 'Unbilled time': 'Horas não faturadas', 'Timer': 'Cronômetro', '▶ Start timer': '▶ Iniciar cronômetro',
  'Start timer': 'Iniciar cronômetro', 'Stop & save': 'Parar e salvar', 'What are you working on?': 'No que você está trabalhando?', 'Ready to invoice': 'Pronto para faturar',
  'Create invoice': 'Criar fatura', 'Edit time': 'Editar horas', 'Bill rate / hour': 'Valor cobrado / hora', 'Cost rate / hour (internal)': 'Custo / hora (interno)', 'Billable': 'Faturável',
  'Log a business trip': 'Lançar viagem a trabalho', 'Edit trip': 'Editar viagem', 'Vehicle': 'Veículo', 'Car': 'Carro', 'Van': 'Van', 'Motorcycle': 'Moto', 'Bicycle': 'Bicicleta',
  'Miles (one way)': 'Milhas (só ida)', 'Return journey?': 'Ida e volta?', 'Yes – double the miles': 'Sim – dobrar as milhas', 'Business purpose': 'Motivo profissional', 'Claimable this tax year': 'A reembolsar neste ano fiscal',
  // payroll
  'Employees': 'Funcionários', 'Add employee': 'Adicionar funcionário', 'Run payroll': 'Rodar folha', 'Pay runs': 'Folhas pagas', 'No pay runs yet.': 'Nenhuma folha ainda.', 'Payslip': 'Holerite',
  'Full name': 'Nome completo', 'NI number': 'Nº do NI', 'Tax code': 'Código de imposto', 'Annual salary': 'Salário anual', 'Employee pension %': 'Pensão do funcionário %', 'Employer pension %': 'Pensão do empregador %',
  'Pay period': 'Período', 'Pay date': 'Data do pagamento', 'Extra (bonus/overtime)': 'Extra (bônus/horas extras)', 'Emp. NI': 'NI func.', 'Employer NI': 'NI empregador', 'Employee NI': 'NI funcionário',
  'Total cost to business': 'Custo total para a empresa', 'Approve & record': 'Aprovar e registrar',
  'Estimates using 2026/27 rates (month 1 basis). Submit the FPS to HMRC through RTI-recognised payroll software.': 'Estimativas com as taxas 2026/27 (base mensal). Envie o FPS ao HMRC por um software de folha reconhecido (RTI).',
  // accounting
  'Journal entries': 'Lançamentos contábeis', 'New journal': 'Novo lançamento', 'New account': 'Nova conta', 'Edit account': 'Editar conta', 'Journal': 'Diário', 'No journal entries yet.': 'Nenhum lançamento ainda.',
  'Manual double-entry adjustments (depreciation, accruals, loans, owner\'s money…)': 'Ajustes manuais de partidas dobradas (depreciação, provisões, empréstimos, dinheiro do sócio…)',
  'Opening balance': 'Saldo inicial', 'Opening balance (bank/card only)': 'Saldo inicial (só banco/cartão)', 'Opening balance date': 'Data do saldo inicial',
  'Assets': 'Ativo', 'Liabilities': 'Passivo', 'Equity': 'Patrimônio líquido', 'Current asset': 'Ativo circulante', 'Fixed asset': 'Ativo imobilizado', 'Current liability': 'Passivo circulante',
  'Long-term liability': 'Passivo de longo prazo', 'Other income': 'Outras receitas', 'Cost of sales': 'Custo das vendas', 'Accounts receivable': 'Contas a receber', 'Accounts payable': 'Contas a pagar (fornecedores)',
  'New fixed asset': 'Novo bem do imobilizado', 'New asset': 'Novo bem', 'Asset': 'Bem', 'Asset account': 'Conta do bem', 'Purchase date': 'Data da compra', 'Cost (ex VAT)': 'Custo (sem VAT)',
  'Record the purchase now?': 'Registrar a compra agora?', 'Depreciation method': 'Método de depreciação', 'Straight line': 'Linear', 'Reducing balance': 'Saldo decrescente',
  'Useful life (years) – straight line': 'Vida útil (anos) – linear', 'Rate % per year – reducing balance': 'Taxa % ao ano – saldo decrescente', 'Residual value': 'Valor residual',
  'Disposed / sold on (optional)': 'Baixado / vendido em (opcional)', 'Bought': 'Comprado', 'Book value': 'Valor contábil', 'Accum. depreciation': 'Depreciação acumulada',
  'Depreciation this year': 'Depreciação no ano', 'No fixed assets yet.': 'Nenhum bem cadastrado.', 'Vans, tools, computers… anything kept for more than a year.': 'Vans, ferramentas, computadores… tudo que é usado por mais de um ano.',
  'Depreciation is posted automatically at each month end (Dr Depreciation, Cr Accumulated depreciation).': 'A depreciação é lançada automaticamente no fim de cada mês (D Depreciação, C Depreciação acumulada).',
  'No – already in the books (bill/expense coded to the asset account)': 'Não – já está na contabilidade (conta/despesa lançada na conta do bem)', 'Yes – paid personally (Director\'s loan)': 'Sim – pago com dinheiro pessoal (conta do sócio)',
  'New budget': 'Novo orçamento anual', 'Budget vs actual': 'Orçado x realizado', 'No budgets yet. Create one for your financial year.': 'Nenhum orçamento ainda. Crie um para o seu ano fiscal.',
  'Year': 'Ano', 'Budget': 'Orçado', 'Actual': 'Realizado', '% of budget': '% do orçado', 'Filter by user, type or name': 'Filtrar por usuário, tipo ou nome', 'When': 'Quando', 'User': 'Usuário', 'Action': 'Ação',
  'Item': 'Item', 'No changes recorded yet.': 'Nenhuma alteração registrada ainda.', 'created': 'criado', 'updated': 'alterado', 'deleted': 'excluído',
  // VAT
  'Mark as filed': 'Marcar como entregue', 'Reopen period': 'Reabrir período', 'Submit to HMRC (MTD)': 'Enviar ao HMRC (MTD)', 'VAT due on sales': 'VAT devido nas vendas',
  'VAT due on EU acquisitions': 'VAT devido em aquisições da UE', 'Total VAT due': 'Total de VAT devido', 'VAT reclaimed on purchases': 'VAT recuperado nas compras',
  'Net VAT payable / (repayable)': 'VAT líquido a pagar / (a restituir)', 'Total sales ex VAT': 'Total de vendas sem VAT', 'Total purchases ex VAT': 'Total de compras sem VAT',
  'Goods supplied to EU': 'Mercadorias fornecidas à UE', 'Goods acquired from EU': 'Mercadorias adquiridas da UE',
  // reports
  'Business overview': 'Visão geral', 'Who owes you': 'Quem te deve', 'What you owe': 'O que você deve', 'Tax & accountant': 'Impostos e contador', 'Planning': 'Planejamento', 'Stock': 'Estoque',
  'Profit and loss': 'Lucros e perdas', 'Balance sheet': 'Balanço patrimonial', 'Statement of cash flows': 'Fluxo de caixa', 'Profit and loss by month': 'Lucros e perdas por mês',
  'Project profitability': 'Lucratividade por projeto', 'Accounts receivable ageing': 'Contas a receber por vencimento', 'Open invoices': 'Faturas em aberto', 'Customer balances': 'Saldos de clientes',
  'Sales by customer': 'Vendas por cliente', 'Sales by product/service': 'Vendas por produto/serviço', 'Time by customer': 'Horas por cliente', 'Accounts payable ageing': 'Contas a pagar por vencimento',
  'Unpaid bills': 'Contas não pagas', 'Expenses by category': 'Despesas por categoria', 'Expenses by supplier': 'Despesas por fornecedor', 'Mileage log': 'Registro de quilometragem',
  'VAT summary (9 boxes)': 'Resumo de VAT (9 caixas)', 'Trial balance': 'Balancete', 'General ledger': 'Razão geral', 'Payroll summary': 'Resumo da folha', 'Stock valuation': 'Valor do estoque',
  'Fixed asset register': 'Registro do imobilizado', 'Saved reports': 'Relatórios salvos', '← All reports': '← Todos os relatórios', 'This month': 'Este mês', 'Last month': 'Mês passado',
  'This quarter': 'Este trimestre', 'This calendar year': 'Este ano', 'This financial year': 'Este ano fiscal', 'UK tax year': 'Ano fiscal do Reino Unido', 'Last year': 'Ano passado', 'Custom': 'Personalizado',
  'No comparison': 'Sem comparação', 'vs previous period': 'x período anterior', 'vs same period last year': 'x mesmo período do ano passado', 'All projects': 'Todos os projetos', 'Change': 'Variação',
  'Total income': 'Total de receitas', 'Total cost of sales': 'Total do custo das vendas', 'Gross profit': 'Lucro bruto', 'Total expenses': 'Total de despesas', 'Net profit': 'Lucro líquido',
  'Accrual basis, excluding VAT.': 'Regime de competência, sem VAT.', 'Total assets': 'Total do ativo', 'Total liabilities': 'Total do passivo', 'Retained earnings': 'Lucros acumulados',
  'Profit for the year': 'Lucro do ano', 'Total equity': 'Total do patrimônio líquido', 'Total liabilities and equity': 'Total do passivo e patrimônio líquido', 'Operating activities': 'Atividades operacionais',
  'Net cash from operating activities': 'Caixa líquido das atividades operacionais', 'Investing activities': 'Atividades de investimento', 'Net cash from investing activities': 'Caixa líquido de investimentos',
  'Financing activities': 'Atividades de financiamento', 'Net cash from financing activities': 'Caixa líquido de financiamentos', 'Net change in cash': 'Variação líquida do caixa',
  'Cash at start of period': 'Caixa no início do período', 'Cash at end of period': 'Caixa no fim do período', 'As of today': 'Até hoje', 'Current': 'A vencer', 'No data for this period.': 'Sem dados neste período.',
  'Sales (ex VAT)': 'Vendas (sem VAT)', 'Amount (ex VAT)': 'Valor (sem VAT)', 'Billable hours': 'Horas faturáveis', 'Billable value': 'Valor faturável', 'Supplier / payee': 'Fornecedor / favorecido',
  'Date / account': 'Data / conta', 'Qty on hand': 'Qtd em estoque', 'Depreciation in period': 'Depreciação no período', 'Book value at end': 'Valor contábil no fim', 'Income and expenses by month': 'Receitas e despesas por mês',
  'VAT due on sales and other outputs': 'VAT devido nas vendas e outras saídas', 'VAT due on acquisitions from EU (NI only)': 'VAT devido em aquisições da UE (só Irlanda do Norte)',
  'Total VAT due (1 + 2)': 'Total de VAT devido (1 + 2)', 'VAT reclaimed on purchases and other inputs': 'VAT recuperado nas compras e outras entradas', 'Net VAT to pay to HMRC or reclaim': 'VAT líquido a pagar ao HMRC ou restituir',
  'Total value of sales, ex VAT': 'Valor total das vendas, sem VAT', 'Total value of purchases, ex VAT': 'Valor total das compras, sem VAT', 'Supplies of goods to EU (NI only)': 'Fornecimento de mercadorias à UE (só Irlanda do Norte)',
  'Acquisitions of goods from EU (NI only)': 'Aquisição de mercadorias da UE (só Irlanda do Norte)', 'Go to': 'Vá para', 'to file a period.': 'para entregar um período.', 'No budget yet — create one in': 'Nenhum orçamento ainda — crie um em',
  // chart of accounts default names
  'Stock': 'Estoque', 'Equipment & tools': 'Equipamentos e ferramentas', 'Vehicles': 'Veículos', 'Accumulated depreciation': 'Depreciação acumulada', 'VAT control': 'Controle de VAT',
  'PAYE & NI payable': 'PAYE e NI a pagar', 'Pension payable': 'Pensão a pagar', "Director's loan account": 'Conta corrente do sócio', 'Bank loan': 'Empréstimo bancário', 'Share capital': 'Capital social',
  'Opening balance equity': 'Patrimônio de saldo inicial', 'Interest': 'Juros', 'Refunds': 'Reembolsos', 'Materials': 'Materiais', 'Subcontractors': 'Terceirizados', 'Advertising': 'Publicidade',
  'Bank charges': 'Tarifas bancárias', 'Equipment': 'Equipamentos', 'Insurance': 'Seguros', 'Office supplies': 'Material de escritório', 'Professional fees': 'Honorários profissionais', 'Rent': 'Aluguel',
  'Software': 'Software', 'Travel': 'Viagens', 'Utilities': 'Contas de consumo', 'Wages': 'Salários', 'Pension contributions': 'Contribuições de pensão', 'Depreciation': 'Depreciação',
  'Business current account': 'Conta corrente empresarial', 'Business credit card': 'Cartão de crédito empresarial',
  // settings
  'Company details': 'Dados da empresa', 'Company name': 'Nome da empresa', 'VAT registration no.': 'Nº de registro de VAT', 'Default VAT %': 'VAT padrão %', 'Payment terms (days)': 'Prazo de pagamento (dias)',
  'Next invoice number': 'Próximo nº de fatura', 'Next estimate number': 'Próximo nº de orçamento', 'Financial year starts (month)': 'Ano fiscal começa (mês)', 'Financial year starts (day)': 'Ano fiscal começa (dia)',
  'Default hourly rate': 'Valor-hora padrão', 'Days between payment reminders': 'Dias entre lembretes de pagamento', 'Close the books up to (closing date)': 'Fechar a contabilidade até (data de fechamento)',
  'Closing date password (optional)': 'Senha do fechamento (opcional)', 'Language': 'Idioma', 'Invoice branding & payments': 'Marca da fatura e pagamentos', 'No logo': 'Sem logo', 'Upload logo': 'Enviar logo',
  'Accent colour': 'Cor de destaque', 'Online payment link (e.g. Stripe / PayPal / GoCardless)': 'Link de pagamento online (ex.: Stripe / PayPal / GoCardless)', 'How to pay (printed on invoices)': 'Como pagar (impresso na fatura)',
  'Team & sign-in': 'Equipe e acesso', 'Change password': 'Trocar senha', 'Sign out': 'Sair', 'Add user': 'Adicionar usuário', 'Temporary password (min 8)': 'Senha provisória (mín. 8)', 'Role': 'Perfil',
  'Data': 'Dados', 'Export backup (JSON)': 'Exportar backup (JSON)', 'Import backup': 'Importar backup', 'Load demo data': 'Carregar dados de exemplo', 'Erase all data': 'Apagar todos os dados',
  'Import customers (CSV)': 'Importar clientes (CSV)', 'Import suppliers (CSV)': 'Importar fornecedores (CSV)', 'Import products (CSV)': 'Importar produtos (CSV)', 'View audit log': 'Ver histórico de alterações',
  'Your data is stored in this browser only. Export a backup regularly.': 'Seus dados ficam só neste navegador. Exporte um backup com frequência.',
  'Your books are saved on the server (with a daily backup). You can also download a copy.': 'Sua contabilidade fica salva no servidor (com backup diário). Você também pode baixar uma cópia.',
  'You are in': 'Você está no', 'local mode': 'modo local', 'Owner': 'Dono', 'Admin (full access + users)': 'Admin (acesso total + usuários)', 'Standard (all except payroll)': 'Padrão (tudo menos folha)',
  'Accountant (full access)': 'Contador (acesso total)', 'Sales only': 'Só vendas', 'Purchases only': 'Só compras', 'Viewer (read-only)': 'Visualizador (só leitura)', 'Enable': 'Ativar', 'Disable': 'Desativar',
  'January': 'Janeiro', 'February': 'Fevereiro', 'March': 'Março', 'April': 'Abril', 'May': 'Maio', 'June': 'Junho', 'July': 'Julho', 'August': 'Agosto', 'September': 'Setembro', 'October': 'Outubro', 'November': 'Novembro', 'December': 'Dezembro',
  'Contracts, delivery notes, photos, PDFs… (up to 8 MB each)': 'Contratos, notas de entrega, fotos, PDFs… (até 8 MB cada)', 'Attach file': 'Anexar arquivo', 'e.g. Ford Transit van, Laptop': 'ex.: Van Ford Transit, notebook',
  'Thank you for your business.': 'Obrigado pela preferência.', 'Your role does not have access to this area. Ask the company owner or an admin.': 'Seu perfil não tem acesso a esta área. Peça ao dono da empresa ou a um admin.',
  'Expires': 'Validade', 'Thank you,': 'Obrigado,',
  ': data lives only in this browser. To sign in, share the books with your team and access them from any device, run the Accutare server (see README:': ': os dados ficam só neste navegador. Para ter login, compartilhar a contabilidade com a equipe e acessar de qualquer aparelho, rode o servidor do Accutare (veja o README:',
  // sign-in
  'Sign in': 'Entrar', 'Create your company account': 'Crie a conta da sua empresa', 'Your name': 'Seu nome', 'Password': 'Senha', 'Create account': 'Criar conta',
  'New here? Create an account': 'Primeira vez? Crie uma conta', 'Already have an account? Sign in': 'Já tem conta? Entre', 'Wrong email or password': 'E-mail ou senha incorretos',
  // toasts & dialogs
  'Invoice saved': 'Fatura salva', 'Estimate saved': 'Orçamento salvo', 'Credit note saved': 'Nota de crédito salva', 'Sales receipt saved': 'Recibo de venda salvo', 'Bill saved': 'Conta salva',
  'Supplier credit saved': 'Crédito de fornecedor salvo', 'Customer saved': 'Cliente salvo', 'Supplier saved': 'Fornecedor salvo', 'Expense saved': 'Despesa salva', 'Saved': 'Salvo', 'Payment recorded': 'Pagamento registrado',
  'Payment saved': 'Pagamento salvo', 'Settings saved': 'Configurações salvas', 'Branding saved': 'Marca salva', 'Logo saved': 'Logo salvo', 'Rule saved': 'Regra salva', 'Account saved': 'Conta salva',
  'Project saved': 'Projeto salvo', 'Time saved': 'Horas salvas', 'Trip saved': 'Viagem salva', 'Employee saved': 'Funcionário salvo', 'Pay run recorded': 'Folha registrada', 'Asset saved': 'Bem salvo',
  'Budget created': 'Orçamento criado', 'Matched': 'Vinculado', 'Recorded': 'Registrado', 'Added to your books': 'Lançado na contabilidade', 'Split added to your books': 'Divisão lançada na contabilidade',
  'Refund recorded': 'Reembolso registrado', 'Purchase order saved': 'Pedido de compra salvo', 'Bill created — stock updated': 'Conta criada — estoque atualizado', 'Draft invoice created': 'Rascunho de fatura criado',
  'Backup restored': 'Backup restaurado', 'Demo data loaded': 'Dados de exemplo carregados', 'All data erased': 'Todos os dados apagados', 'Expense deleted': 'Despesa excluída', 'Wrong password': 'Senha incorreta',
  'VAT return marked as filed': 'Declaração de VAT marcada como entregue', 'Add a customer first': 'Cadastre um cliente primeiro', 'Add a supplier first': 'Cadastre um fornecedor primeiro', 'Add an employee first': 'Cadastre um funcionário primeiro',
  'Enter an amount': 'Informe um valor', 'Add at least one line': 'Adicione pelo menos uma linha', 'Debits must equal credits': 'Débitos e créditos precisam ser iguais',
  'The split amounts must add up to the transaction': 'A soma das divisões precisa ser igual à transação', 'Tick the bills to pay': 'Marque as contas a pagar', 'Report saved — find it at the top of Reports': 'Relatório salvo — ele aparece no topo de Relatórios',
  'Closed period unlocked for this session — please repeat the change': 'Período fechado liberado nesta sessão — repita a alteração', 'Delete?': 'Excluir?', 'Delete this expense?': 'Excluir esta despesa?',
  'Delete this payment?': 'Excluir este pagamento?', 'Delete this bill?': 'Excluir esta conta?', 'Delete rule?': 'Excluir a regra?', 'Remove this attachment?': 'Remover este anexo?',
  'Replace all data with demo data?': 'Substituir todos os dados pelos dados de exemplo?', 'Erase ALL data? This cannot be undone.': 'Apagar TODOS os dados? Isso não pode ser desfeito.',
  'Undo this transaction? The linked entry will be removed.': 'Desfazer esta transação? O lançamento vinculado será removido.', 'New company name': 'Nome da nova empresa', 'Name this report': 'Dê um nome a este relatório',
  'Reading receipt…': 'Lendo o recibo…', 'Filled in from receipt — please check.': 'Preenchido a partir do recibo — confira.', 'Could not find a total, please type it in.': 'Não encontrei o total, digite por favor.',
};

// Patterns for text that contains numbers, names or dates.
const PT_RULES = [
  [/^← (.+)$/, (m, x) => `← ${tr(x)}`], [/^Box (\d)$/, 'Caixa $1'],
  [/^For review \((\d+)\)$/, 'Para revisar ($1)'], [/^Rules \((\d+)\)$/, 'Regras ($1)'], [/^Attachments \((\d+)\)$/, 'Anexos ($1)'], [/^Match (invoice|bill) \((\d+)\)$/, (m, a, n) => `Vincular ${a === 'invoice' ? 'fatura' : 'conta'} (${n})`],
  [/^Unpaid invoices · (\d+)$/, 'Faturas não pagas · $1'], [/^Overdue · (\d+)$/, 'Vencidas · $1'], [/^Bank balance · (\d+) to review$/, 'Saldo bancário · $1 para revisar'], [/^(\d+) to review$/, '$1 para revisar'],
  [/^Edit (invoice|estimate|credit note|sales receipt) #(.+)$/, (m, k, n) => `Editar ${{ invoice: 'fatura', estimate: 'orçamento', 'credit note': 'nota de crédito', 'sales receipt': 'recibo de venda' }[k]} nº ${n}`],
  [/^New (invoice|estimate|credit note|sales receipt)$/, (m, k) => ({ invoice: 'Nova fatura', estimate: 'Novo orçamento', 'credit note': 'Nova nota de crédito', 'sales receipt': 'Novo recibo de venda' }[k])],
  [/^Receive payment — #(.+?) \((\w+)\)$/, 'Receber pagamento — nº $1 ($2)'], [/^Receive payment from (.+)$/, 'Receber pagamento de $1'], [/^Pay bill — (.+)$/, 'Pagar conta — $1'],
  [/^Import into (.+)$/, 'Importar para $1'], [/^Reconcile (.+)$/, 'Conciliar $1'], [/^Return for (.+)$/, 'Declaração de $1'], [/^Due (\d.+)$/, 'Vence em $1'], [/^Dated (.+) · due (.+)$/, 'Emitida em $1 · vence em $2'],
  [/^As of (.+)$/, 'Em $1'], [/^Balance at (.+)$/, 'Saldo em $1'], [/^Business miles · tax year (.+)$/, 'Milhas a trabalho · ano fiscal $1'], [/^Latest (\d+) changes$/, 'Últimas $1 alterações'],
  [/^Calculate VAT at (.+)$/, 'Calcular VAT de $1'], [/^Yes – paid from (.+)$/, 'Sim – pago de $1'], [/^Total: (.+)$/, 'Total: $1'], [/^Money (in|out) · (.+)$/, (m, d, v) => `${d === 'in' ? 'Entrada' : 'Saída'} · ${v}`],
  [/^Categorise: (.+)$/, (m, c) => `Categorizar: ${tr(c)}`], [/^Match: Invoice #(.+)$/, 'Vincular: fatura nº $1'], [/^Match: Bill (.+)$/, 'Vincular: conta $1'], [/^(\d+) hours$/, '$1 horas'],
  [/^Rule “(.+)”: (.+)$/, (m, r, c) => `Regra “${r}”: ${tr(c)}`], [/^Split · (\d+) lines$/, 'Dividida · $1 linhas'], [/^Payment · invoice #(.+)$/, 'Pagamento · fatura nº $1'],
  [/^Invoice #(\S+) \(due (.+)\)$/, 'Fatura nº $1 (vence em $2)'], [/^Payment – thank you \(inv #(.+)\)$/, 'Pagamento – obrigado (fatura nº $1)'], [/^Available (.+) of (.+)$/, 'Disponível $1 de $2'],
  [/^(\d+) line\(s\) copied from the invoice · (.+) each time$/, '$1 linha(s) copiadas da fatura · $2 a cada vez'], [/^(.+) left to assign$/, 'Faltam $1 para distribuir'], [/^Sent (.+)$/, 'Enviada em $1'],
  [/^(\d+) transactions? imported$/, '$1 transação(ões) importada(s)'], [/^(\d+) transaction\(s\) added by rules$/, '$1 transação(ões) lançada(s) pelas regras'], [/^(\d+) bill\(s\) paid$/, '$1 conta(s) paga(s)'],
  [/^(\d+) imported$/, '$1 importado(s)'], [/^(\d+) file\(s\) attached$/, '$1 arquivo(s) anexado(s)'], [/^Invoice #(\S+) created$/, 'Fatura nº $1 criada'],
  [/^(\d+) overdue invoice\(s\) need a reminder$/, '$1 fatura(s) vencida(s) precisam de lembrete'], [/^(\d+) bank transaction\(s\) to review$/, '$1 transação(ões) do banco para revisar'],
  [/^(\d+) bill\(s\) due within 7 days$/, '$1 conta(s) vencendo em 7 dias'], [/^(\d+) draft invoice\(s\) not sent$/, '$1 rascunho(s) de fatura não enviado(s)'], [/^(\d+) unbilled time entr(y|ies)$/, '$1 lançamento(s) de horas não faturado(s)'],
  [/^Low stock: (.+)$/, 'Estoque baixo: $1'], [/^VAT return for last quarter not filed$/, 'Declaração de VAT do último trimestre não entregue'], [/^The books are closed up to (.+)$/, 'A contabilidade está fechada até $1'],
  [/^Expense · (.+)$/, 'Despesa · $1'], [/^Bill payment · (.+)$/, 'Pagamento de conta · $1'], [/^Mileage · (.+)$/, 'Quilometragem · $1'], [/^Bill · (.+)$/, 'Conta · $1'], [/^Invoice #(.+)$/, 'Fatura nº $1'],
  [/^(.+) applied$/, '$1 aplicado'], [/^Delete (.+)\?$/, 'Excluir $1?'], [/^Saved · (.+) kept as credit on account$/, 'Salvo · $1 ficou como crédito'], [/^Pay bill$/, 'Pagar conta'],
];

let lang = 'en';
export const getLang = () => lang;

function tr(text) {
  if (lang !== 'pt') return text;
  if (PT[text] !== undefined) return PT[text];
  for (const [re, rep] of PT_RULES) if (re.test(text)) return text.replace(re, rep);
  return text;
}
export const t = tr;

function translateNode(node) {
  if (node.nodeType === 3) {
    const raw = node.nodeValue, trimmed = raw.trim();
    // Documents sent to customers/employees (invoice, estimate, statement, payslip) stay in English.
    if (!trimmed || node.parentElement?.closest('script,style,[data-no-i18n],.invoice-doc,.payslip')) return;
    const out = tr(trimmed);
    if (out !== trimmed) node.nodeValue = raw.replace(trimmed, out);
    return;
  }
  if (node.nodeType !== 1) return;
  for (const a of ['placeholder', 'title', 'aria-label']) {
    const v = node.getAttribute?.(a);
    if (v) { const o = tr(v); if (o !== v) node.setAttribute(a, o); }
  }
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (w.nextNode()) {
    const n = w.currentNode;
    if (n.nodeType === 3) translateNode(n);
    else for (const a of ['placeholder', 'title', 'aria-label']) { const v = n.getAttribute(a); if (v) { const o = tr(v); if (o !== v) n.setAttribute(a, o); } }
  }
}

export function setLang(l) {
  lang = l === 'pt' ? 'pt' : 'en';
  try { localStorage.setItem('accutare:lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  setLocale(lang === 'pt' ? 'pt-BR' : 'en-GB');
}

/** Start translating the whole page (and everything added later). */
export function startI18n() {
  let saved = 'en';
  const browser = (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  try { saved = localStorage.getItem('accutare:lang') || browser; } catch { saved = browser; }
  setLang(saved);
  if (lang === 'en') return;
  translateNode(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  for (const fn of ['alert', 'confirm', 'prompt']) {
    const orig = window[fn].bind(window);
    window[fn] = (msg, ...rest) => orig(typeof msg === 'string' ? msg.split('\n').map((x) => tr(x.trim()) || x).join('\n') : msg, ...rest);
  }
}
