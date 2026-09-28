<?php

namespace App\Http\Requests\AI;

use App\Services\AI\AiInputSanitizer;
use Illuminate\Foundation\Http\FormRequest;

class ChatAIRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Chat is for authenticated users only — no guest access, no fallback identities.
        return (bool) $this->user();
    }

    protected function prepareForValidation(): void
    {
        $history = $this->input('history');

        if (! is_array($history)) {
            $history = [];
        }

        // Whitelist shape & roles before validation runs
        $history = array_values(array_filter($history, function ($entry) {
            return is_array($entry)
                && isset($entry['role'], $entry['content'])
                && is_string($entry['role'])
                && is_string($entry['content']);
        }));

        $this->merge([
            'history' => $history,
        ]);
    }

    public function rules(): array
    {
        return [
            'message' => [
                'required',
                'string',
                'min:1',
                'max:'.AiInputSanitizer::MAX_MESSAGE_LENGTH,
            ],
            'history' => ['nullable', 'array', 'max:'.AiInputSanitizer::MAX_HISTORY_TURNS],
            'history.*.role' => ['required_with:history', 'string', 'in:user,model,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:'.AiInputSanitizer::MAX_HISTORY_MESSAGE_LENGTH],
        ];
    }

    public function messages(): array
    {
        return [
            'message.required' => 'Please type a message before sending.',
            'message.max' => 'Your message is too long. Please keep it under '.AiInputSanitizer::MAX_MESSAGE_LENGTH.' characters.',
            'history.max' => 'Conversation history is too long. Please start a new chat.',
            'history.*.role.in' => 'Conversation history contains an invalid role.',
        ];
    }
}
