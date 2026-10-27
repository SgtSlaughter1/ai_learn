<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Admin\Concerns\ValidatesCorrectOptions;
use App\Models\Question;
use Illuminate\Foundation\Http\FormRequest;

class UpdateQuestionRequest extends FormRequest
{
    use ValidatesCorrectOptions;

    /** Authorized by the route's role gate and the controller's policy checks. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'topic_id' => ['required', 'exists:topics,id'],
            'question_text' => ['required', 'string'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'type' => ['nullable', 'string', 'in:multiple_choice,multiple_select,short_answer,essay,true_false'],
            'difficulty' => ['nullable', 'string', 'in:easy,medium,hard'],
            'explanation' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'school_id' => ['nullable', 'exists:schools,id'],
            'grade_level' => ['nullable', 'string', 'max:50'],
            'marks' => ['nullable', 'integer', 'min:1', 'max:100'],
            'options' => ['nullable', 'array'],
            'options.*.id' => ['nullable'],
            'options.*.option_text' => ['required_with:options', 'string'],
            'options.*.is_correct' => ['required_with:options', 'boolean'],
            'options.*.explanation' => ['nullable', 'string'],
            'options.*.sort_order' => ['nullable', 'integer'],
            // The shared passage, poem, diagram or table this question is about. Sent whole
            // with every question in it, identified by a device-made id, so questions added
            // offline before the passage reached the server still end up on one passage.
            'context' => ['nullable', 'array'],
            'context.client_id' => ['required_with:context', 'uuid'],
            'context.type' => ['nullable', 'string', 'in:passage,poem,diagram,table'],
            'context.title' => ['nullable', 'string', 'max:255'],
            'context.instructions' => ['nullable', 'string', 'max:500'],
            'context.body' => ['nullable', 'string', 'max:60000'],
            'context.image_url' => ['nullable', 'string', 'max:500'],
            'context.show_line_numbers' => ['nullable', 'boolean'],
            'detach_context' => ['nullable', 'boolean'],
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $context = $this->input('context');
            if (is_array($context) && blank($context['body'] ?? null) && blank($context['image_url'] ?? null)) {
                $validator->errors()->add('context.body', 'Add the passage text or a picture for these questions.');
            }
            $options = (array) $this->input('options', []);
            if (! empty($options)) {
                // No type sent: the question keeps the type it already has.
                $type = $this->input('type') ?? Question::whereKey($this->route('id'))->value('type');
                $this->checkCorrectOptions($validator, $options, $type);
            }
        });
    }
}
