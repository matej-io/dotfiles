#!/usr/bin/env node

function fromTo(from, to) {
	return [
		{
			from: {
				key_code: from,
			},
			to: {
				key_code: to,
			},
		},
	];
}

function genericModifierFN(mod, from, to) {
	const modVar = `${mod}_mod`;
	return [
		{
			from: {
				modifiers: {
					optional: ['any'],
				},
				simultaneous: [
					{
						key_code: mod,
					},
					{
						key_code: from,
					},
				],
				simultaneous_options: {
					key_down_order: 'strict',
					key_up_order: 'strict_inverse',
					to_after_key_up: [
						{
							set_variable: {
								name: modVar,
								value: 0,
							},
						},
					],
				},
			},
			parameters: {
				'basic.simultaneous_threshold_milliseconds': 500 /* Default: 1000 */,
			},
			to: [
				{
					set_variable: {
						name: modVar,
						value: 1,
					},
				},
				...to,
			],
			type: 'basic',
		},
		{
			conditions: [
				{
					name: modVar,
					type: 'variable_if',
					value: 1,
				},
			],
			from: {
				key_code: from,
				modifiers: {
					optional: ['any'],
				},
			},
			to,
			type: 'basic',
		},
	];
}

function modifierFN(mod, from, to, toMods) {
	const toModifiers = toMods
		? { modifiers: Array.isArray(toMods) ? toMods : [toMods] }
		: {};
	return genericModifierFN(mod, from, [{ key_code: to, ...toModifiers }]);
}

function repeatModifierFN(mod, from, to, toMods, repeatCount) {
	const toModifiers = toMods
		? { modifiers: Array.isArray(toMods) ? toMods : [toMods] }
		: {};
	const toArray = [];
	for (let i = 0; i < repeatCount; i++) {
		toArray.push({ key_code: to, ...toModifiers });
	}
	return genericModifierFN(mod, from, toArray);
}

function spaceFN(from, to, toMods) {
	return modifierFN('spacebar', from, to, toMods);
}

function swap(a, b) {
	return [...fromTo(a, b), ...fromTo(b, a)];
}

const PARAMETER_DEFAULTS = {
	'basic.simultaneous_threshold_milliseconds': 50,
	'basic.to_delayed_action_delay_milliseconds': 500,
	'basic.to_if_alone_timeout_milliseconds': 1000,
	'basic.to_if_held_down_threshold_milliseconds': 500,
};

const VANILLA_PROFILE = {
	complex_modifications: {
		parameters: PARAMETER_DEFAULTS,
		rules: [],
	},
	name: 'Vanilla',
	selected: false,
	simple_modifications: [],
};

const DEFAULT_PROFILE = {
	...VANILLA_PROFILE,
	simple_modifications: [
		{
			from: {
				key_code: 'caps_lock',
			},
			to: [
				{
					key_code: 'left_control',
				},
			],
		},
	],
	complex_modifications: {
		parameters: {
			...PARAMETER_DEFAULTS,
			'basic.to_if_alone_timeout_milliseconds': 500 /* Default: 1000 */,
		},
		rules: [
			{
				description: 'Numeric qwerty row',
				manipulators: [
					...spaceFN('q', '1'),
					...spaceFN('w', '2'),
					...spaceFN('e', '3'),
					...spaceFN('r', '4'),
					...spaceFN('t', '5'),
					...spaceFN('y', '6'),
					...spaceFN('u', '7'),
					...spaceFN('i', '8'),
					...spaceFN('o', '9'),
					...spaceFN('p', '0'),
				],
			},
			{
				description: 'Brackets and special characters',
				manipulators: [
					...spaceFN('a', '1', 'left_shift'),
					...spaceFN('s', '2', 'left_shift'),
					...spaceFN('d', 'open_bracket'),
					...spaceFN('x', 'close_bracket'),
					...spaceFN('f', 'open_bracket', 'left_shift'),
					...spaceFN('c', 'close_bracket', 'left_shift'),
					...spaceFN('g', '9', 'left_shift'),
					...spaceFN('v', '0', 'left_shift'),
					...spaceFN('h', 'equal_sign', 'left_shift'),
					...spaceFN('n', 'hyphen'),
					...spaceFN('j', 'equal_sign'),
					...spaceFN('k', '8', 'left_shift'),
					...spaceFN('l', '7', 'left_shift'),
					...spaceFN('semicolon', 'backslash', 'left_shift'),
					...spaceFN('m', 'hyphen', 'left_shift'),
					...spaceFN('slash', 'backslash'),
					...spaceFN('z', '6', 'left_shift'),
					...spaceFN('b', '4', 'left_shift'),
					...spaceFN('comma', '3', 'left_shift'),
					...spaceFN('period', '5', 'left_shift'),
					...spaceFN(
						'open_bracket',
						'grave_accent_and_tilde',
						'left_shift'
					),
				],
			},
			{
				description: 'Basic movememnt bindings',
				manipulators: [
					...modifierFN('f', 'j', 'left_arrow'),
					...modifierFN('f', 'l', 'right_arrow'),
					...modifierFN('f', 'i', 'up_arrow'),
					...modifierFN('f', 'k', 'down_arrow'),
					...modifierFN('d', 'j', 'left_arrow', 'option'),
					...modifierFN('d', 'l', 'right_arrow', 'option'),
					...modifierFN('d', 'i', 'up_arrow', 'option'),
					...modifierFN('d', 'k', 'down_arrow', 'option'),
					...repeatModifierFN('s', 'j', 'left_arrow', 'option', 3),
					...repeatModifierFN('s', 'l', 'right_arrow', 'option', 3),
					...repeatModifierFN('s', 'i', 'up_arrow', 'option', 10),
					...repeatModifierFN('s', 'k', 'down_arrow', 'option', 10),
					...modifierFN('a', 'j', 'left_arrow', 'left_command'),
					...modifierFN('a', 'l', 'right_arrow', 'left_command'),
					...modifierFN('a', 'i', 'up_arrow', 'left_command'),
					...modifierFN('a', 'k', 'down_arrow', 'left_command'),
				],
			},
			{
				description: 'UI bindings',
				manipulators: [
					...modifierFN('t', 'j', 'open_bracket', [
						'left_shift',
						'left_command',
					]),
					...modifierFN('t', 'l', 'close_bracket', [
						'left_shift',
						'left_command',
					]),
				],
			},
			{
				description: 'Basic selection bindings',
				manipulators: [
					...modifierFN('e', 'j', 'left_arrow', ['option', 'right_shift']),
					...modifierFN('e', 'l', 'right_arrow', [
						'option',
						'right_shift',
					]),
					...modifierFN('e', 'i', 'up_arrow', ['right_shift']),
					...modifierFN('e', 'k', 'down_arrow', ['right_shift']),
					// ...modifierFN('d', 'j', 'left_arrow', ['option', 'right_shift']),
					// ...modifierFN('d', 'l', 'right_arrow', [
					// 	'option',
					// 	'right_shift',
					// ]),
					// ...modifierFN('e', 'i', 'up_arrow', ['option', 'right_shift']),
					// ...modifierFN('e', 'k', 'down_arrow', ['option', 'right_shift']),
					// ...modifierFN('w', 'j', 'left_arrow', [
					// 	'left_command',
					// 	'right_shift',
					// ]),
					// ...modifierFN('w', 'l', 'right_arrow', [
					// 	'left_command',
					// 	'right_shift',
					// ]),
				],
			},
			{
				description: 'Basic deletion and line insetion bindings', // to do here
				manipulators: [
					...modifierFN('c', 'j', 'delete_or_backspace'),
					...modifierFN('c', 'l', 'delete_or_backspace', ['fn']),
					...genericModifierFN('v', 'k', [
						// insert empty line below
						{
							key_code: 'right_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'return_or_enter',
							modifiers: [],
						},
					]),
					...genericModifierFN('v', 'i', [
						// insert empty line above
						{
							key_code: 'up_arrow',
							modifiers: [],
						},
						{
							key_code: 'right_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'return_or_enter',
							modifiers: [],
						},
					]),
					// ...modifierFN('c', 'i', 'up_arrow'),
					// ...modifierFN('c', 'k', 'down_arrow'),
					...modifierFN('v', 'j', 'delete_or_backspace', ['option']),
					...modifierFN('v', 'l', 'delete_or_backspace', ['option', 'fn']),
					// ...modifierFN('e', 'i', 'up_arrow', ['option', 'right_shift']),
					// ...modifierFN('e', 'k', 'down_arrow', ['option', 'right_shift']),
					...modifierFN('x', 'j', 'delete_or_backspace', ['left_command']),
					...genericModifierFN('x', 'l', [
						{
							key_code: 'right_arrow',
							modifiers: ['left_command', 'right_shift'],
						},
						{
							key_code: 'delete_or_backspace',
							modifiers: [],
						},
					]),
					// delete line
					...genericModifierFN('x', 'k', [
						{
							key_code: 'right_arrow',
							modifiers: ['left_command'],
						},
						{
							key_code: 'delete_or_backspace',
							modifiers: ['left_command'],
						},
						{
							key_code: 'delete_or_backspace',
							modifiers: ['left_command'],
						},
						{
							key_code: 'delete_or_backspace',
							modifiers: [],
						},
						{
							key_code: 'down_arrow',
							modifiers: [],
						},
					]),
					...genericModifierFN('g', 'l', [
						{
							shell_command:
								'/Users/matej/Projects/tselect/bin/tselect deleteTillCapital',
						},
					]),
				],
			},
			{
				description: 'Toggle CAPS_LOCK with LEFT_SHIFT + RIGHT_SHIFT',
				manipulators: [
					{
						from: {
							key_code: 'left_shift',
							modifiers: {
								mandatory: ['right_shift'],
								optional: ['caps_lock'],
							},
						},
						to: [
							{
								key_code: 'caps_lock',
							},
						],
						to_if_alone: [
							{
								key_code: 'left_shift',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'right_shift',
							modifiers: {
								mandatory: ['left_shift'],
								optional: ['caps_lock'],
							},
						},
						to: [
							{
								key_code: 'caps_lock',
							},
						],
						to_if_alone: [
							{
								key_code: 'right_shift',
							},
						],
						type: 'basic',
					},
				],
			},
			{
				description: 'Post Esc if Caps is tapped, Control if held.',
				manipulators: [
					{
						type: 'basic',
						from: {
							key_code: 'left_control',
							modifiers: {
								optional: ['any'],
							},
						},
						to: [
							{
								key_code: 'left_control',
								lazy: true,
							},
						],
						to_if_alone: [
							{
								key_code: 'escape',
							},
						],
					},
				],
			},
			{
				description:
					'Change return to control if pressed with other keys, to return if pressed alone',
				manipulators: [
					{
						from: {
							key_code: 'return_or_enter',
							modifiers: {
								optional: ['any'],
							},
						},
						to: [
							{
								key_code: 'right_control',
							},
						],
						to_if_alone: [
							{
								key_code: 'return_or_enter',
							},
						],
						type: 'basic',
					},
				],
			},
			{
				description: 'Testing',
				manipulators: [
					{
						from: {
							key_code: 'g',
							modifiers: {
								mandatory: ['left_control'],
							},
						},
						to: [
							{
								shell_command:
									'/Users/matej/Projects/tselect/bin/tselect',
							},
						],
						type: 'basic',
					},
					{
						from: {
							key_code: 'g',
							modifiers: {
								mandatory: ['right_control'],
							},
						},
						to: [
							{
								shell_command:
									'/Users/matej/Projects/tselect/bin/tselect',
							},
						],
						type: 'basic',
					},
				],
			},
		],
	},
	name: 'Default',
	selected: true,
};

process.stdout.write(
	JSON.stringify(
		{
			global: {
				check_for_updates_on_startup: true,
				show_in_menu_bar: true,
				show_profile_name_in_menu_bar: false,
			},
			profiles: [DEFAULT_PROFILE, VANILLA_PROFILE],
		},
		null,
		2
	) + '\n'
);
