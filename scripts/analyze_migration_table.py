#!/usr/bin/env python3
"""Infer a review-only table baseline from chronological Supabase migrations."""

from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable


IDENTIFIER = r'(?:"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)'
RELATION = rf'{IDENTIFIER}(?:\s*\.\s*{IDENTIFIER})?'
TABLE_CONSTRAINT_PREFIXES = (
    'constraint ', 'primary key', 'unique ', 'check ', 'foreign key', 'exclude ',
)


@dataclass
class SqlObject:
    name: str
    statement: str
    source: str


@dataclass
class ColumnDefinition:
    name: str
    definition: str
    source: str


@dataclass
class ManualReview:
    source: str
    reason: str
    statement: str


@dataclass
class Analysis:
    table: str
    migration_count: int
    touching_files: list[str] = field(default_factory=list)
    columns: OrderedDict[str, ColumnDefinition] = field(default_factory=OrderedDict)
    constraints: OrderedDict[str, SqlObject] = field(default_factory=OrderedDict)
    policies: OrderedDict[str, SqlObject] = field(default_factory=OrderedDict)
    triggers: OrderedDict[str, SqlObject] = field(default_factory=OrderedDict)
    indexes: OrderedDict[str, SqlObject] = field(default_factory=OrderedDict)
    trigger_functions: OrderedDict[str, SqlObject] = field(default_factory=OrderedDict)
    manual_review: list[ManualReview] = field(default_factory=list)
    rls_enabled: bool = False
    rls_source: str | None = None
    create_table_source: str | None = None
    history: dict[str, int] = field(default_factory=lambda: {
        'column_definitions': 0,
        'column_drops': 0,
        'policy_creates': 0,
        'policy_drops': 0,
        'trigger_creates': 0,
        'trigger_drops': 0,
        'index_creates': 0,
        'index_drops': 0,
    })


def split_sql_statements(sql: str) -> list[str]:
    """Split SQL on top-level semicolons while preserving quoted bodies."""
    statements: list[str] = []
    start = 0
    index = 0
    quote: str | None = None
    dollar_tag: str | None = None
    block_comment_depth = 0
    line_comment = False

    while index < len(sql):
        current = sql[index]
        following = sql[index + 1] if index + 1 < len(sql) else ''

        if line_comment:
            if current == '\n':
                line_comment = False
            index += 1
            continue

        if block_comment_depth:
            if current == '/' and following == '*':
                block_comment_depth += 1
                index += 2
            elif current == '*' and following == '/':
                block_comment_depth -= 1
                index += 2
            else:
                index += 1
            continue

        if dollar_tag:
            if sql.startswith(dollar_tag, index):
                index += len(dollar_tag)
                dollar_tag = None
            else:
                index += 1
            continue

        if quote:
            if current == quote:
                if following == quote:
                    index += 2
                    continue
                quote = None
            index += 1
            continue

        if current == '-' and following == '-':
            line_comment = True
            index += 2
        elif current == '/' and following == '*':
            block_comment_depth = 1
            index += 2
        elif current in ("'", '"'):
            quote = current
            index += 1
        elif current == '$':
            match = re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', sql[index:])
            if match:
                dollar_tag = match.group(0)
                index += len(dollar_tag)
            else:
                index += 1
        elif current == ';':
            statement = sql[start:index + 1].strip()
            if statement:
                statements.append(statement)
            start = index + 1
            index += 1
        else:
            index += 1

    trailing = sql[start:].strip()
    if trailing:
        statements.append(trailing)
    return statements


def split_top_level_commas(sql: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    index = 0
    quote: str | None = None
    dollar_tag: str | None = None

    while index < len(sql):
        current = sql[index]
        following = sql[index + 1] if index + 1 < len(sql) else ''
        if dollar_tag:
            if sql.startswith(dollar_tag, index):
                index += len(dollar_tag)
                dollar_tag = None
            else:
                index += 1
            continue
        if quote:
            if current == quote:
                if following == quote:
                    index += 2
                    continue
                quote = None
            index += 1
            continue
        if current in ("'", '"'):
            quote = current
        elif current == '$':
            match = re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', sql[index:])
            if match:
                dollar_tag = match.group(0)
                index += len(dollar_tag)
                continue
        elif current == '(':
            depth += 1
        elif current == ')':
            depth -= 1
        elif current == ',' and depth == 0:
            parts.append(sql[start:index].strip())
            start = index + 1
        index += 1

    final = sql[start:].strip()
    if final:
        parts.append(final)
    return parts


def strip_leading_comments(statement: str) -> str:
    remaining = statement.lstrip('\ufeff \t\r\n')
    if remaining.startswith('--'):
        newline = remaining.find('\n')
        return '' if newline < 0 else strip_leading_comments(remaining[newline + 1:])
    if remaining.startswith('/*'):
        end = remaining.find('*/', 2)
        return remaining if end < 0 else strip_leading_comments(remaining[end + 2:])
    return remaining


def normalize_identifier(identifier: str) -> str:
    cleaned = identifier.strip()
    if cleaned.startswith('"') and cleaned.endswith('"'):
        return cleaned[1:-1].replace('""', '"').lower()
    return cleaned.lower()


def relation_name(relation: str) -> str:
    return normalize_identifier(re.split(r'\s*\.\s*', relation.strip())[-1])


def object_name(identifier: str) -> str:
    return normalize_identifier(identifier)


def statement_mentions_table(statement: str, table: str) -> bool:
    escaped = re.escape(table)
    return re.search(
        rf'(?<![A-Za-z0-9_$])(?:public\s*\.\s*)?"?{escaped}"?(?![A-Za-z0-9_$])',
        statement,
        flags=re.IGNORECASE,
    ) is not None


def find_matching_parenthesis(sql: str, opening: int) -> int | None:
    depth = 0
    quote: str | None = None
    index = opening
    while index < len(sql):
        current = sql[index]
        following = sql[index + 1] if index + 1 < len(sql) else ''
        if quote:
            if current == quote:
                if following == quote:
                    index += 2
                    continue
                quote = None
        elif current in ("'", '"'):
            quote = current
        elif current == '(':
            depth += 1
        elif current == ')':
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


class MigrationAnalyzer:
    def __init__(self, migrations_dir: Path, table: str) -> None:
        self.migrations_dir = migrations_dir
        self.table = table.lower()
        files = sorted(migrations_dir.glob('*.sql'), key=lambda path: path.name)
        self.files = files
        self.analysis = Analysis(table=self.table, migration_count=len(files))
        self._all_functions: OrderedDict[str, SqlObject] = OrderedDict()

    def analyze(self) -> Analysis:
        for migration in self.files:
            content = migration.read_text(encoding='utf-8')
            statements = split_sql_statements(content)
            if statement_mentions_table(content, self.table):
                self.analysis.touching_files.append(migration.name)
            for statement in statements:
                self._process_statement(statement, migration.name)
        self._resolve_trigger_functions()
        if not self.analysis.create_table_source:
            self._manual('migration history', 'لم يتم العثور على CREATE TABLE مباشر للجدول', self.table)
        return self.analysis

    def _process_statement(self, raw_statement: str, source: str) -> None:
        statement = strip_leading_comments(raw_statement).strip()
        if not statement:
            return
        if self._track_function(statement, source):
            return
        self._track_index_drop(statement)
        if self._track_create_table(statement, source):
            return
        if self._track_alter_table(statement, source):
            return
        if self._track_policy(statement, source):
            return
        if self._track_trigger(statement, source):
            return
        if self._track_index_create(statement, source):
            return
        if self._track_dynamic_trigger_loop(statement, source):
            return
        if statement_mentions_table(statement, self.table) and self._contains_embedded_table_ddl(statement):
            self._manual(source, 'DDL خاص بالجدول داخل كتلة إجرائية؛ لم يتم افتراض نتيجة التنفيذ', statement)

    def _track_create_table(self, statement: str, source: str) -> bool:
        match = re.match(
            rf'CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?P<table>{RELATION})\s*\(',
            statement,
            flags=re.IGNORECASE,
        )
        if not match or relation_name(match.group('table')) != self.table:
            return False
        opening = statement.find('(', match.start())
        closing = find_matching_parenthesis(statement, opening)
        if closing is None:
            self._manual(source, 'تعريف CREATE TABLE غير مكتمل بنيويًا', statement)
            return True
        self.analysis.create_table_source = source
        for definition in split_top_level_commas(statement[opening + 1:closing]):
            self._record_initial_definition(definition, source)
        return True

    def _record_initial_definition(self, definition: str, source: str) -> None:
        lowered = definition.lstrip().lower()
        if lowered.startswith(TABLE_CONSTRAINT_PREFIXES):
            key = self._constraint_key(definition)
            self.analysis.constraints[key] = SqlObject(key, definition, source)
            return
        match = re.match(rf'(?P<name>{IDENTIFIER})\s+.+', definition, flags=re.DOTALL)
        if not match:
            self._manual(source, 'تعريف عمود غير مفهوم داخل CREATE TABLE', definition)
            return
        name = object_name(match.group('name'))
        self.analysis.columns[name] = ColumnDefinition(name, definition.strip(), source)
        self.analysis.history['column_definitions'] += 1

    def _track_alter_table(self, statement: str, source: str) -> bool:
        match = re.match(
            rf'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?P<table>{RELATION})\s+(?P<body>.+?);?$',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not match or relation_name(match.group('table')) != self.table:
            return False
        body = match.group('body').strip().rstrip(';').strip()
        for action in split_top_level_commas(body):
            self._apply_alter_action(action, source)
        return True

    def _apply_alter_action(self, action: str, source: str) -> None:
        normalized = re.sub(r'\s+', ' ', action.strip())
        if re.fullmatch(r'ENABLE ROW LEVEL SECURITY', normalized, flags=re.IGNORECASE):
            self.analysis.rls_enabled = True
            self.analysis.rls_source = source
            return
        if re.fullmatch(r'DISABLE ROW LEVEL SECURITY', normalized, flags=re.IGNORECASE):
            self.analysis.rls_enabled = False
            self.analysis.rls_source = source
            return
        if self._apply_add_action(action, source):
            return
        if self._apply_drop_action(action, source):
            return
        if self._apply_rename_column(action, source):
            return
        if self._apply_simple_column_alter(action, source):
            return
        self._manual(source, 'ALTER TABLE غير مدعوم تلقائيًا', f'ALTER TABLE public.{self.table} {action};')

    def _apply_add_action(self, action: str, source: str) -> bool:
        constraint = re.match(r'ADD\s+(?P<definition>CONSTRAINT\s+.+)$', action, re.IGNORECASE | re.DOTALL)
        if constraint:
            definition = constraint.group('definition').strip()
            key = self._constraint_key(definition)
            self.analysis.constraints[key] = SqlObject(key, definition, source)
            return True
        column = re.match(
            rf'ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?P<name>{IDENTIFIER})\s+(?P<rest>.+)$',
            action,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not column:
            return False
        name = object_name(column.group('name'))
        definition = f'{column.group("name")} {column.group("rest").strip()}'
        self.analysis.columns[name] = ColumnDefinition(name, definition, source)
        self.analysis.history['column_definitions'] += 1
        return True

    def _apply_drop_action(self, action: str, source: str) -> bool:
        column = re.match(
            rf'DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(?P<name>{IDENTIFIER})(?=\s|;|$)',
            action,
            flags=re.IGNORECASE,
        )
        if column:
            column_name = object_name(column.group('name'))
            self.analysis.columns.pop(column_name, None)
            self._drop_indexes_referencing_column(column_name)
            self.analysis.history['column_drops'] += 1
            return True
        constraint = re.match(
            rf'DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?(?P<name>{IDENTIFIER})(?=\s|;|$)',
            action,
            flags=re.IGNORECASE,
        )
        if constraint:
            constraint_name = object_name(constraint.group('name'))
            removed = self.analysis.constraints.pop(constraint_name, None)
            if not removed:
                self._drop_generated_inline_check(constraint_name, source)
            return True
        return False

    def _drop_generated_inline_check(self, constraint_name: str, source: str) -> None:
        for column_name, column in self.analysis.columns.items():
            generated_name = f'{self.table}_{column_name}_check'
            if constraint_name != generated_name:
                continue
            definition = self._without_inline_check(column.definition)
            self.analysis.columns[column_name] = ColumnDefinition(column_name, definition, source)
            return

    def _without_inline_check(self, definition: str) -> str:
        match = re.search(r'\s+CHECK\s*\(', definition, flags=re.IGNORECASE)
        if not match:
            return definition
        opening = definition.find('(', match.start())
        closing = find_matching_parenthesis(definition, opening)
        if closing is None:
            return definition
        return (definition[:match.start()] + definition[closing + 1:]).strip()

    def _apply_rename_column(self, action: str, source: str) -> bool:
        match = re.match(
            rf'RENAME\s+COLUMN\s+(?P<old>{IDENTIFIER})\s+TO\s+(?P<new>{IDENTIFIER})$',
            action.strip(),
            flags=re.IGNORECASE,
        )
        if not match:
            return False
        old_name = object_name(match.group('old'))
        new_name = object_name(match.group('new'))
        existing = self.analysis.columns.pop(old_name, None)
        if not existing:
            self._manual(source, 'إعادة تسمية عمود غير موجود في الحالة المستنتجة', action)
            return True
        renamed = re.sub(rf'^\s*{re.escape(existing.definition.split()[0])}', match.group('new'), existing.definition, count=1)
        self.analysis.columns[new_name] = ColumnDefinition(new_name, renamed, source)
        return True

    def _apply_simple_column_alter(self, action: str, source: str) -> bool:
        match = re.match(
            rf'ALTER\s+COLUMN\s+(?P<name>{IDENTIFIER})\s+(?P<operation>.+)$',
            action.strip(),
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not match:
            return False
        name = object_name(match.group('name'))
        column = self.analysis.columns.get(name)
        if not column:
            self._manual(source, 'تعديل عمود غير موجود في الحالة المستنتجة', action)
            return True
        operation = re.sub(r'\s+', ' ', match.group('operation').strip())
        definition = self._updated_column_definition(column.definition, operation)
        if definition is None:
            return False
        self.analysis.columns[name] = ColumnDefinition(name, definition, source)
        return True

    def _updated_column_definition(self, definition: str, operation: str) -> str | None:
        if re.fullmatch(r'SET NOT NULL|DROP NOT NULL', operation, flags=re.IGNORECASE):
            updated = re.sub(r'\s+NOT\s+NULL\b', '', definition, flags=re.IGNORECASE)
            return updated + (' NOT NULL' if operation.upper().startswith('SET') else '')
        default = re.fullmatch(r'SET\s+DEFAULT\s+(?P<value>.+)', operation, flags=re.IGNORECASE | re.DOTALL)
        if default:
            updated = self._without_default(definition)
            return f'{updated} DEFAULT {default.group("value").strip()}'
        if re.fullmatch(r'DROP DEFAULT', operation, flags=re.IGNORECASE):
            return self._without_default(definition)
        column_type = re.fullmatch(r'TYPE\s+(?P<type>.+?)(?:\s+USING\s+.+)?', operation, flags=re.IGNORECASE | re.DOTALL)
        if column_type:
            return self._replace_column_type(definition, column_type.group('type').strip())
        return None

    def _without_default(self, definition: str) -> str:
        return re.sub(
            r'\s+DEFAULT\s+.+?(?=\s+(?:NOT\s+NULL|NULL|CHECK|REFERENCES|UNIQUE|PRIMARY\s+KEY|COLLATE|GENERATED)\b|$)',
            '',
            definition,
            flags=re.IGNORECASE | re.DOTALL,
        ).rstrip()

    def _replace_column_type(self, definition: str, new_type: str) -> str:
        match = re.match(rf'(?P<name>{IDENTIFIER})\s+(?P<rest>.+)', definition, flags=re.DOTALL)
        if not match:
            return definition
        rest = match.group('rest')
        constraint = re.search(
            r'\s+(?:DEFAULT|NOT\s+NULL|NULL|CHECK|REFERENCES|UNIQUE|PRIMARY\s+KEY|COLLATE|GENERATED)\b',
            rest,
            flags=re.IGNORECASE,
        )
        suffix = rest[constraint.start():] if constraint else ''
        return f'{match.group("name")} {new_type}{suffix}'

    def _drop_indexes_referencing_column(self, column_name: str) -> None:
        for index_name, sql_object in list(self.analysis.indexes.items()):
            definition = re.search(
                rf'\bON\s+(?:ONLY\s+)?{RELATION}(?P<body>.+)$',
                sql_object.statement,
                flags=re.IGNORECASE | re.DOTALL,
            )
            if definition and statement_mentions_table(definition.group('body'), column_name):
                self.analysis.indexes.pop(index_name)
                self.analysis.history['index_drops'] += 1

    def _track_policy(self, statement: str, source: str) -> bool:
        create = re.match(
            rf'CREATE\s+POLICY\s+(?P<name>{IDENTIFIER})\s+ON\s+(?P<table>{RELATION})(?=\s|;|$)',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if create and relation_name(create.group('table')) == self.table:
            name = object_name(create.group('name'))
            self.analysis.policies[name] = SqlObject(name, statement.rstrip(';') + ';', source)
            self.analysis.history['policy_creates'] += 1
            return True
        drop = re.match(
            rf'DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?P<name>{IDENTIFIER})\s+ON\s+(?P<table>{RELATION})(?=\s|;|$)',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if drop and relation_name(drop.group('table')) == self.table:
            self.analysis.policies.pop(object_name(drop.group('name')), None)
            self.analysis.history['policy_drops'] += 1
            return True
        return False

    def _track_trigger(self, statement: str, source: str) -> bool:
        create = re.match(
            rf'CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(?P<name>{IDENTIFIER})(?=\s).+?\bON\s+(?P<table>{RELATION})(?=\s|;|$)',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if create and relation_name(create.group('table')) == self.table:
            name = object_name(create.group('name'))
            self.analysis.triggers[name] = SqlObject(name, statement.rstrip(';') + ';', source)
            self.analysis.history['trigger_creates'] += 1
            return True
        drop = re.match(
            rf'DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?(?P<name>{IDENTIFIER})\s+ON\s+(?P<table>{RELATION})(?=\s|;|$)',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if drop and relation_name(drop.group('table')) == self.table:
            self.analysis.triggers.pop(object_name(drop.group('name')), None)
            self.analysis.history['trigger_drops'] += 1
            return True
        return False

    def _track_index_create(self, statement: str, source: str) -> bool:
        create = re.match(
            rf'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(?P<name>{RELATION})\s+ON\s+(?:ONLY\s+)?(?P<table>{RELATION})(?=\s|\(|;|$)',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not create or relation_name(create.group('table')) != self.table:
            return False
        name = relation_name(create.group('name'))
        self.analysis.indexes[name] = SqlObject(name, statement.rstrip(';') + ';', source)
        self.analysis.history['index_creates'] += 1
        return True

    def _track_index_drop(self, statement: str) -> None:
        drop = re.match(
            rf'DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(?P<names>.+?);?$',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not drop:
            return
        for candidate in split_top_level_commas(drop.group('names').rstrip(';')):
            name_match = re.match(rf'(?P<name>{RELATION})', candidate.strip())
            if not name_match:
                continue
            name = relation_name(name_match.group('name'))
            if name in self.analysis.indexes:
                self.analysis.indexes.pop(name)
                self.analysis.history['index_drops'] += 1

    def _track_function(self, statement: str, source: str) -> bool:
        match = re.match(
            rf'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?P<name>{RELATION})\s*\(',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if match:
            name = relation_name(match.group('name'))
            self._all_functions[name] = SqlObject(name, statement.rstrip(';') + ';', source)
            return True
        return False

    def _resolve_trigger_functions(self) -> None:
        for trigger in self.analysis.triggers.values():
            match = re.search(
                rf'EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?P<name>{RELATION})\s*\(',
                trigger.statement,
                flags=re.IGNORECASE,
            )
            if not match:
                self._manual(trigger.source, 'تعذر تحديد الدالة المستخدمة بواسطة trigger', trigger.statement)
                continue
            name = relation_name(match.group('name'))
            function = self._all_functions.get(name)
            if function:
                self.analysis.trigger_functions[name] = function
            else:
                self._manual(trigger.source, f'تعريف دالة trigger غير موجود في migrations: {name}', trigger.statement)

    def _track_dynamic_trigger_loop(self, statement: str, source: str) -> bool:
        if not re.match(r'DO\s+\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', statement, flags=re.IGNORECASE):
            return False
        table_array = re.search(
            r'v_tables\s+text\[\]\s*:=\s*ARRAY\s*\[(?P<tables>.*?)\]',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not table_array:
            return False
        tables = {
            match.group(1).replace("''", "'").lower()
            for match in re.finditer(r"'((?:''|[^'])*)'", table_array.group('tables'))
        }
        if self.table not in tables:
            return False
        processed = False
        format_calls = re.finditer(
            r"EXECUTE\s+format\(\s*'(?P<template>(?:''|[^'])*)'\s*,(?P<args>.*?)\);",
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        for call in format_calls:
            template = call.group('template').replace("''", "'")
            args = [part.strip().lower() for part in split_top_level_commas(call.group('args'))]
            if not args or any(argument != 'v_table' for argument in args):
                continue
            concrete = template
            for _argument in args:
                concrete = concrete.replace('%I', self.table, 1)
            if '%I' in concrete or '%L' in concrete:
                continue
            if self._track_trigger(concrete.rstrip(';') + ';', source):
                processed = True
        return processed

    def _contains_embedded_table_ddl(self, statement: str) -> bool:
        escaped = re.escape(self.table)
        exact_target = re.search(
            rf'(?:ALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+(?:public\s*\.\s*)?"?{escaped}"?(?![A-Za-z0-9_$"])|'
            rf'(?:CREATE|DROP)\s+(?:POLICY|TRIGGER)\b.+?\bON\s+(?:public\s*\.\s*)?"?{escaped}"?(?![A-Za-z0-9_$"]))',
            statement,
            flags=re.IGNORECASE | re.DOTALL,
        )
        dynamic_ddl = (
            re.search(r'\b(?:EXECUTE\s+format|FOREACH|FOR\s+.+?\s+IN\s+SELECT)\b', statement, re.IGNORECASE | re.DOTALL)
            and re.search(r'\b(?:ALTER\s+TABLE|CREATE\s+POLICY|DROP\s+POLICY|CREATE\s+TRIGGER|DROP\s+TRIGGER)\b', statement, re.IGNORECASE)
        )
        return exact_target is not None or dynamic_ddl is not None

    def _constraint_key(self, definition: str) -> str:
        named = re.match(rf'CONSTRAINT\s+(?P<name>{IDENTIFIER})', definition, flags=re.IGNORECASE)
        if named:
            return object_name(named.group('name'))
        return f'anonymous_{len(self.analysis.constraints) + 1}'

    def _manual(self, source: str, reason: str, statement: str) -> None:
        compact = statement.strip()
        if any(review.source == source and review.reason == reason for review in self.analysis.manual_review):
            return
        candidate = ManualReview(source, reason, compact)
        self.analysis.manual_review.append(candidate)


def source_comment(source: str) -> str:
    return f'-- Source: {source}'


def render_draft(analysis: Analysis) -> str:
    lines = [
        '-- REVIEW-ONLY CONSOLIDATION DRAFT. DO NOT APPLY TO PRODUCTION.',
        '-- Inferred from migration history; compare with `supabase db dump --schema public`.',
        f'-- Table: public.{analysis.table}',
        '',
    ]
    if not analysis.create_table_source or not analysis.columns:
        lines.extend(['-- CREATE TABLE omitted because no complete direct definition was inferred.', ''])
    else:
        lines.extend([
            source_comment(analysis.create_table_source),
            f'CREATE TABLE IF NOT EXISTS public.{analysis.table} (',
        ])
    definitions: list[str] = []
    for column in analysis.columns.values():
        definitions.append(f'  {source_comment(column.source)}\n  {column.definition}')
    for constraint in analysis.constraints.values():
        definitions.append(f'  {source_comment(constraint.source)}\n  {constraint.statement}')
    if definitions and analysis.create_table_source:
        lines.append(',\n'.join(definitions))
        lines.extend([');', ''])

    if analysis.rls_enabled:
        lines.extend([
            source_comment(analysis.rls_source or 'unknown'),
            f'ALTER TABLE public.{analysis.table} ENABLE ROW LEVEL SECURITY;',
            '',
        ])

    lines.extend(render_objects('Trigger functions', analysis.trigger_functions.values()))
    lines.extend(render_objects('Active policies', analysis.policies.values()))
    lines.extend(render_objects('Active triggers', analysis.triggers.values()))
    lines.extend(render_objects('Active indexes', analysis.indexes.values()))

    if analysis.manual_review:
        lines.extend(['-- MANUAL REVIEW REQUIRED', '-- The statements below were not applied to the inferred state.'])
        for review in analysis.manual_review:
            lines.extend([
                f'-- Source: {review.source}',
                f'-- Reason: {review.reason}',
                *[f'-- {line}' for line in review.statement.splitlines()],
                '',
            ])
    return '\n'.join(lines).rstrip() + '\n'


def render_objects(title: str, objects: Iterable[SqlObject]) -> list[str]:
    rendered = [f'-- {title}']
    found = False
    for sql_object in objects:
        found = True
        rendered.extend([source_comment(sql_object.source), sql_object.statement, ''])
    if not found:
        rendered.extend(['-- None inferred.', ''])
    return rendered


def render_report(analysis: Analysis, draft_path: Path) -> str:
    history = analysis.history
    status = 'needs manual review' if analysis.manual_review else 'draft ready'
    lines = [
        f'# Consolidation report: `{analysis.table}`',
        '',
        f'- Status: **{status}**',
        f'- Migrations scanned: {analysis.migration_count}',
        f'- Files mentioning the table: {len(analysis.touching_files)}',
        f'- Draft: `{draft_path.as_posix()}`',
        f'- Columns: {len(analysis.columns)} final / {history["column_definitions"]} definitions historically / {history["column_drops"]} drops',
        f'- Policies: {len(analysis.policies)} active / {history["policy_creates"]} creates / {history["policy_drops"]} drops',
        f'- Triggers: {len(analysis.triggers)} active / {history["trigger_creates"]} creates / {history["trigger_drops"]} drops',
        f'- Indexes: {len(analysis.indexes)} active / {history["index_creates"]} creates / {history["index_drops"]} tracked drops',
        '',
        '## Manual review',
        '',
    ]
    if analysis.manual_review:
        for review in analysis.manual_review:
            lines.append(f'- `{review.source}`: {review.reason}')
    else:
        lines.append('- No parser ambiguities detected.')
    lines.extend(['', '## Source migrations', ''])
    lines.extend(f'- `{filename}`' for filename in analysis.touching_files)
    return '\n'.join(lines) + '\n'


def json_ready(analysis: Analysis) -> dict[str, object]:
    payload = asdict(analysis)
    for field_name in ('columns', 'constraints', 'policies', 'triggers', 'indexes', 'trigger_functions'):
        payload[field_name] = list(payload[field_name].values())
    return payload


def update_tracking(output_dir: Path, analysis: Analysis) -> None:
    tracking_path = output_dir / 'TRACKING.md'
    header = '| Table | Date | Status | Notes |\n|---|---|---|---|\n'
    existing = tracking_path.read_text(encoding='utf-8') if tracking_path.exists() else header
    rows = [line for line in existing.splitlines() if not line.startswith(f'| {analysis.table} |')]
    status = 'مسودة جاهزة - تحتاج مراجعة يدوية' if analysis.manual_review else 'مسودة جاهزة'
    notes = f'{len(analysis.touching_files)} source files; {len(analysis.manual_review)} manual-review items'
    rows.append(f'| {analysis.table} | {date.today().isoformat()} | {status} | {notes} |')
    tracking_path.write_text('\n'.join(rows).rstrip() + '\n', encoding='utf-8')


def write_outputs(analysis: Analysis, output_dir: Path) -> tuple[Path, Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    draft_path = output_dir / f'{analysis.table}.sql'
    report_path = output_dir / f'{analysis.table}.report.md'
    json_path = output_dir / f'{analysis.table}.analysis.json'
    draft_path.write_text(render_draft(analysis), encoding='utf-8')
    report_path.write_text(render_report(analysis, draft_path), encoding='utf-8')
    json_path.write_text(json.dumps(json_ready(analysis), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    update_tracking(output_dir, analysis)
    return draft_path, report_path, json_path


def resolve_workspace_path(candidate: Path, workspace_root: Path, label: str) -> Path:
    resolved_root = workspace_root.resolve()
    resolved_candidate = candidate.resolve() if candidate.is_absolute() else (resolved_root / candidate).resolve()
    if not resolved_candidate.is_relative_to(resolved_root):
        raise SystemExit(f'{label} must stay inside the project directory')
    return resolved_candidate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('table', help='Unqualified public table name, for example employees')
    parser.add_argument('--migrations-dir', type=Path, default=Path('supabase/migrations'))
    parser.add_argument('--output-dir', type=Path, default=Path('supabase/migrations_consolidated_draft'))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', args.table):
        raise SystemExit('Table name must be an unqualified SQL identifier')
    workspace_root = Path.cwd().resolve()
    migrations_dir = resolve_workspace_path(args.migrations_dir, workspace_root, 'Migrations directory')
    output_dir = resolve_workspace_path(args.output_dir, workspace_root, 'Output directory')
    analysis = MigrationAnalyzer(migrations_dir, args.table).analyze()
    paths = write_outputs(analysis, output_dir)
    print(f'Scanned {analysis.migration_count} migrations; {len(analysis.touching_files)} mention {analysis.table}.')
    print(f'Final inferred state: {len(analysis.columns)} columns, {len(analysis.policies)} policies, '
          f'{len(analysis.triggers)} triggers, {len(analysis.indexes)} indexes.')
    print(f'Manual-review items: {len(analysis.manual_review)}')
    for path in paths:
        print(path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
